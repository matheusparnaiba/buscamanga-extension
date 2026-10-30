#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * BuscaMangá Extension - Simulação Controlada de Fontes
 * Executa todas as extensões no ambiente simulado do Paperback
 * e valida: Discover (Categorias/Carrosséis/Capas), Detalhes, Capítulos e Páginas (Leitor).
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const BUNDLES_DIR = path.resolve("bundles");
const TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Paperback-iOS/0.9";

function createMockApplication(interceptors) {
  return {
    getDefaultUserAgent: async () => USER_AGENT,
    scheduleRequest: async (req) => {
      let currentReq = { ...req };

      // Request interceptors
      for (const inter of interceptors) {
        if (inter.instance && typeof inter.instance.interceptRequest === "function") {
          currentReq = await inter.instance.interceptRequest(currentReq);
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let res;
      let ab;
      try {
        res = await fetch(currentReq.url, {
          method: currentReq.method || "GET",
          headers: currentReq.headers || {},
          body: currentReq.body,
          signal: controller.signal,
          redirect: "follow",
        });
        ab = await res.arrayBuffer();
      } finally {
        clearTimeout(timer);
      }

      const responseObj = {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      };

      // Response interceptors
      let currentData = ab;
      for (const inter of interceptors) {
        if (inter.instance && typeof inter.instance.interceptResponse === "function") {
          currentData = await inter.instance.interceptResponse(
            currentReq,
            responseObj,
            currentData,
          );
        }
      }

      return [responseObj, currentData];
    },
    arrayBufferToUTF8String: (buffer) => {
      if (!buffer) return "";
      try {
        return new TextDecoder("utf-8").decode(buffer);
      } catch {
        return "";
      }
    },
    Selector: (target, name) => ({ target, name }),
    registerInterceptor: (id, reqSel, resSel) => {
      const instance = reqSel?.target || resSel?.target;
      interceptors.push({ id, instance });
    },
    unregisterInterceptor: (id) => {
      const idx = interceptors.findIndex((i) => i.id === id);
      if (idx !== -1) interceptors.splice(idx, 1);
    },
    getState: () => undefined,
    setState: () => {},
    sleep: (s) => new Promise((r) => setTimeout(r, s * 1000)),
  };
}

async function runExtensionSimulation(sourceId) {
  const bundlePath = path.join(BUNDLES_DIR, sourceId, "index.js");
  const infoPath = path.join(BUNDLES_DIR, sourceId, "info.json");

  if (!fs.existsSync(bundlePath)) {
    return {
      id: sourceId,
      status: "MISSING_BUNDLE",
      error: "Bundle index.js não encontrado",
    };
  }

  let info = {};
  try {
    if (fs.existsSync(infoPath)) {
      info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    }
  } catch {}

  const interceptors = [];
  const mockApp = createMockApplication(interceptors);

  const context = {
    Application: mockApp,
    console: {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
    },
    setTimeout,
    clearTimeout,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    Buffer,
    ArrayBuffer,
    Uint8Array,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Map,
    Set,
    Error,
    TypeError,
    RangeError,
    JSON,
    Math,
  };

  const result = {
    id: sourceId,
    name: info.name || sourceId,
    version: info.version || "unknown",
    status: "UNKNOWN",
    discover: {
      totalSections: 0,
      sections: [],
    },
    manga: null,
    chapters: {
      count: 0,
      sampleTitle: null,
    },
    reader: {
      pagesCount: 0,
      samplePage: null,
    },
    issues: [],
    cloudflare: false,
    durationMs: 0,
  };

  const startTime = Date.now();

  try {
    const code = fs.readFileSync(bundlePath, "utf8");
    vm.createContext(context);
    vm.runInContext(code, context);

    const sourceExports = context.source || {};
    let ext = sourceExports[sourceId] || context[sourceId] || sourceExports.default;

    if (!ext) {
      for (const key of Object.keys(sourceExports)) {
        if (
          sourceExports[key] &&
          (typeof sourceExports[key].getDiscoverSections === "function" ||
            typeof sourceExports[key].getHomePageSections === "function")
        ) {
          ext = sourceExports[key];
          break;
        }
      }
    }

    if (!ext) {
      result.status = "ERROR";
      result.issues.push("Não foi possível instanciar a classe da extensão");
      result.durationMs = Date.now() - startTime;
      return result;
    }

    if (typeof ext.initialise === "function") {
      try {
        await ext.initialise();
      } catch {
        // Interceptor initialization issue
      }
    }

    // 1. Discover Sections
    let sections = [];
    if (typeof ext.getDiscoverSections === "function") {
      try {
        sections = await ext.getDiscoverSections();
      } catch (e) {
        result.issues.push(`Erro em getDiscoverSections: ${e.message}`);
      }
    }

    result.discover.totalSections = sections.length;
    let firstFoundManga = null;

    for (const sec of sections) {
      const secData = {
        id: sec.id,
        title: sec.title,
        itemCount: 0,
        hasCover: false,
        sampleTitle: null,
        sampleCover: null,
        error: null,
      };

      try {
        const paged = await ext.getDiscoverSectionItems(sec, undefined);
        const items = paged?.items || [];
        secData.itemCount = items.length;

        if (items.length > 0) {
          const sample = items[0];
          secData.sampleTitle = sample.title || null;
          secData.sampleCover = sample.imageUrl || null;
          secData.hasCover = Boolean(sample.imageUrl && sample.imageUrl.startsWith("http"));

          if (!firstFoundManga && (sample.mangaId || sample.id)) {
            firstFoundManga = sample;
          }
        } else {
          secData.error = "Nenhum item retornado (vazio)";
        }
      } catch (err) {
        const msg = String(err?.message || err);
        secData.error = msg;
        if (msg.toLowerCase().includes("cloudflare") || err?.type === "cloudflareError") {
          result.cloudflare = true;
        }
      }

      result.discover.sections.push(secData);
    }

    // 2. Manga Details & Chapters
    if (firstFoundManga) {
      const mangaId = firstFoundManga.mangaId || firstFoundManga.id;
      let sourceManga = null;

      if (typeof ext.getMangaDetails === "function") {
        try {
          sourceManga = await ext.getMangaDetails(mangaId);
          result.manga = {
            id: mangaId,
            title: sourceManga?.mangaInfo?.primaryTitle || firstFoundManga.title,
            thumbnailUrl: sourceManga?.mangaInfo?.thumbnailUrl || null,
          };
        } catch (e) {
          result.issues.push(`Erro em getMangaDetails: ${e.message}`);
        }
      }

      const mangaForChapters = sourceManga || {
        mangaId,
        mangaInfo: { primaryTitle: firstFoundManga.title },
      };

      // 3. Chapters
      let chapters = [];
      if (typeof ext.getChapters === "function") {
        try {
          chapters = await ext.getChapters(mangaForChapters);
          result.chapters.count = chapters.length;
          if (chapters.length > 0) {
            result.chapters.sampleTitle = chapters[0].title || chapters[0].chapterId;
          } else {
            result.issues.push("Nenhum capítulo retornado");
          }
        } catch (e) {
          const msg = String(e?.message || e);
          result.issues.push(`Erro em getChapters: ${msg}`);
          if (msg.toLowerCase().includes("cloudflare") || e?.type === "cloudflareError") {
            result.cloudflare = true;
          }
        }
      }

      // 4. Chapter Details (Reader)
      if (chapters.length > 0 && typeof ext.getChapterDetails === "function") {
        try {
          const firstChapter = chapters[0];
          const chapDetails = await ext.getChapterDetails(firstChapter);
          const pages = chapDetails?.pages || [];
          result.reader.pagesCount = pages.length;
          if (pages.length > 0) {
            result.reader.samplePage = pages[0];
          } else {
            result.issues.push("Capítulo retornou 0 páginas no leitor");
          }
        } catch (e) {
          const msg = String(e?.message || e);
          result.issues.push(`Erro em getChapterDetails: ${msg}`);
          if (msg.toLowerCase().includes("cloudflare") || e?.type === "cloudflareError") {
            result.cloudflare = true;
          }
        }
      }
    } else {
      result.issues.push("Nenhuma obra encontrada para testar capítulos e leitor");
    }

    // Determine final status
    const workingSections = result.discover.sections.filter((s) => s.itemCount > 0);
    const hasChapters = result.chapters.count > 0;
    const hasPages = result.reader.pagesCount > 0;

    if (result.cloudflare) {
      result.status = "CLOUDFLARE";
    } else if (workingSections.length > 0 && hasChapters && hasPages) {
      if (workingSections.length === result.discover.totalSections) {
        result.status = "OPERATIONAL";
      } else {
        result.status = "PARTIAL";
      }
    } else if (workingSections.length > 0 && (!hasChapters || !hasPages)) {
      result.status = "PARTIAL";
    } else {
      result.status = "BROKEN";
    }
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("cloudflare") || err?.type === "cloudflareError") {
      result.cloudflare = true;
      result.status = "CLOUDFLARE";
    } else {
      result.status = "ERROR";
      result.issues.push(`Erro fatal na execução: ${msg}`);
    }
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

async function main() {
  console.log("=".repeat(70));
  console.log("⚡ SIMULAÇÃO CONTROLADA DE TODAS AS FONTES (PAPERBACK RUNTIME)");
  console.log("=".repeat(70));

  const sources = fs
    .readdirSync(BUNDLES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(BUNDLES_DIR, d.name, "index.js")))
    .map((d) => d.name)
    .sort();

  console.log(`Detectadas ${sources.length} extensões para simulação.\n`);

  const results = [];
  let index = 0;

  for (const sourceId of sources) {
    index++;
    process.stdout.write(`[${index}/${sources.length}] Testando ${sourceId.padEnd(22)} ... `);
    try {
      const res = await runExtensionSimulation(sourceId);
      results.push(res);

      let badge = "❓";
      if (res.status === "OPERATIONAL") badge = "🟢 100% OK";
      else if (res.status === "PARTIAL") badge = "🟡 PARCIAL";
      else if (res.status === "CLOUDFLARE") badge = "🛡️ CLOUDFLARE";
      else if (res.status === "BROKEN") badge = "🔴 QUEBRADA";
      else badge = "💥 ERRO";

      const secInfo = `${res.discover.sections.filter((s) => s.itemCount > 0).length}/${res.discover.totalSections} seções`;
      const chapInfo = `${res.chapters.count} caps`;
      const pageInfo = `${res.reader.pagesCount} pgs`;

      console.log(
        `${badge.padEnd(16)} (${secInfo}, ${chapInfo}, ${pageInfo}) [${res.durationMs}ms]`,
      );
    } catch (e) {
      console.log(`💥 ERRO AO EXECUTAR: ${e.message}`);
      results.push({
        id: sourceId,
        name: sourceId,
        status: "CRASH",
        issues: [e.message],
      });
    }
  }

  // Summary counts
  const operational = results.filter((r) => r.status === "OPERATIONAL");
  const partial = results.filter((r) => r.status === "PARTIAL");
  const cloudflare = results.filter((r) => r.status === "CLOUDFLARE");
  const broken = results.filter(
    (r) => r.status === "BROKEN" || r.status === "ERROR" || r.status === "CRASH",
  );

  console.log("\n" + "=".repeat(70));
  console.log("📊 RESUMO GERAL DA SIMULAÇÃO:");
  console.log(`  🟢 Total Operacional (100% Funcional):  ${operational.length}`);
  console.log(`  🟡 Parcial (Alguma seção ou seletor):   ${partial.length}`);
  console.log(`  🛡️ Protegidas por Cloudflare (Manual):  ${cloudflare.length}`);
  console.log(`  🔴 Quebradas / Offline / Erro:         ${broken.length}`);
  console.log(`  📦 Total de Fontes Testadas:            ${results.length}`);
  console.log("=".repeat(70) + "\n");

  // Save report
  const reportPath = path.resolve("simulation_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Relatório JSON detalhado salvo em: ${reportPath}`);
}

main().catch(console.error);
