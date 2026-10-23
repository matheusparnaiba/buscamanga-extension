#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * BuscaMangá Extension - Health Check das 24 Fontes
 * Verifica a conectividade e disponibilidade dos domínios oficiais.
 */

const SOURCES = [
  { id: "ArthurScan", name: "Arthur Scan", url: "https://arthurscan.xyz" },
  { id: "BorutoExplorer", name: "Boruto Explorer", url: "https://leitor.borutoexplorer.com.br" },
  { id: "Fliptru", name: "Fliptru", url: "https://fliptru.com.br" },
  { id: "HentaiHQ", name: "Hentai HQ", url: "https://hentaihq.net" },
  { id: "Hipertoon", name: "Hipertoon", url: "https://hipertoon.com", cloudflare: true },
  { id: "HQHentai", name: "HQ Hentai", url: "https://hqhentai.online" },
  { id: "HQNow", name: "HQ Now", url: "https://www.hq-now.com" },
  { id: "HQPorno", name: "HQ Porno", url: "https://www.hqporno.net" },
  { id: "KamiSamaExplorer", name: "Kami Sama Explorer", url: "https://leitor.kamisama.com.br" },
  { id: "LeituraManga", name: "Leitura Manga", url: "https://leituramanga.net" },
  { id: "MangaFlix", name: "Manga Flix", url: "https://mangaflix.net" },
  { id: "MangaLivreBlog", name: "MangaLivre Blog", url: "https://mangalivre.blog" },
  { id: "MangaLivreTo", name: "MangaLivre To", url: "https://mangalivre.to" },
  { id: "MangaNYX", name: "MangaNYX", url: "https://manganyx.com", cloudflare: true },
  { id: "MangaOnline", name: "Manga Online", url: "https://mangaonline.love" },
  {
    id: "MangasBrasuka",
    name: "Mangás Brasuka",
    url: "https://mangasbrasuka.com.br",
    cloudflare: true,
  },
  { id: "Manhastro", name: "Manhastro", url: "https://manhastro.com" },
  { id: "MuitoHentai", name: "Muito Hentai", url: "https://www.muitohentai.com" },
  { id: "MundoHentai", name: "Mundo Hentai", url: "https://mundohentaioficial.com" },
  { id: "NebulosaScan", name: "Nebulosa Scan", url: "https://nebulosascan.com" },
  { id: "NHentaiBR", name: "NHentai BR", url: "https://nhentaibr.com" },
  { id: "NinjaScan", name: "Ninja Scan", url: "https://ninjacomics.xyz" },
  { id: "TaoSect", name: "Tao Sect", url: "https://taosect.com" },
  { id: "YuriOnAir", name: "Yuri on Air", url: "https://yurionair.top" },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Paperback-iOS/0.9";

async function checkSource(source) {
  const start = Date.now();
  try {
    const res = await fetch(source.url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    const elapsed = Date.now() - start;
    const isCloudflare =
      res.headers.get("cf-ray") !== null ||
      res.headers.get("server")?.toLowerCase().includes("cloudflare");

    if (res.status === 200) {
      return {
        ...source,
        status: "OK",
        code: 200,
        elapsed,
        badge: "🟢 ONLINE",
        note: isCloudflare ? "CF Protegido" : "Direto",
      };
    } else if (res.status === 403 || res.status === 503) {
      return {
        ...source,
        status: source.cloudflare ? "OK" : "CHALLENGE",
        code: res.status,
        elapsed,
        badge: source.cloudflare ? "🛡️ WAF/BYPASS" : "⚠️ CHALLENGE",
        note: "Cloudflare Challenge ativo (Bypass nativo no Paperback)",
      };
    } else {
      return {
        ...source,
        status: "WARN",
        code: res.status,
        elapsed,
        badge: `🟡 HTTP ${res.status}`,
        note: res.statusText || "Resposta inesperada",
      };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    return {
      ...source,
      status: "FAIL",
      code: 0,
      elapsed,
      badge: "🔴 ERRO",
      note: err.name === "TimeoutError" ? "Timeout (>10s)" : err.message,
    };
  }
}

async function run() {
  console.log("===============================================================");
  console.log(" 🔍 BuscaMangá Extension - Health Check das 24 Fontes");
  console.log("===============================================================");
  console.log(`Testando conectividade de ${SOURCES.length} fontes...\n`);

  const results = await Promise.all(SOURCES.map(checkSource));

  console.log("| Status        | Fonte                  | Tempo  | Domínio");
  console.log(
    "| ------------- | ---------------------- | ------ | -------------------------------------",
  );

  let successCount = 0;
  for (const r of results) {
    const isHealthy = r.status === "OK" || (r.cloudflare && (r.code === 200 || r.code === 403));
    if (isHealthy) successCount++;

    const statusPadded = r.badge.padEnd(13, " ");
    const namePadded = r.name.padEnd(22, " ");
    const timePadded = `${r.elapsed}ms`.padStart(6, " ");
    const domain = r.url.replace("https://", "").replace("www.", "");

    console.log(`| ${statusPadded} | ${namePadded} | ${timePadded} | ${domain} (${r.note})`);
  }

  console.log("===============================================================");
  console.log(` Resumo: ${successCount}/${SOURCES.length} fontes operacionais.`);
  console.log("===============================================================\n");

  if (successCount < SOURCES.length) {
    process.exitCode = 0; // Aviso não-bloqueante para CI
  }
}

void run();
