#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * BuscaMangá Extension - Health Check das Fontes
 * Verifica a conectividade e disponibilidade dos domínios oficiais.
 */

const SOURCES = [
  { id: "AcervoHentai", name: "Acervo Hentai", url: "https://acervohentai.com" },
  { id: "ApenasUmaFa", name: "Apenas Uma Fã", url: "https://apenasuma-fa.blogspot.com" },
  { id: "ArthurScan", name: "Arthur Scan", url: "https://arthurscan.xyz" },
  { id: "Astratoons", name: "AstraToons", url: "https://new.astratoons.com" },
  { id: "Azuretoons", name: "Azuretoons", url: "https://azuretoons.com" },
  { id: "BlackoutComics", name: "Blackout Comics", url: "https://blackoutcomics.com" },
  { id: "BorutoExplorer", name: "Boruto Explorer", url: "https://leitor.borutoexplorer.com.br" },
  { id: "BrasilHentai", name: "Brasil Hentai", url: "https://brasilhentai.com" },
  { id: "BRScans", name: "BRScans", url: "https://brscans.vercel.app" },
  { id: "Capitoons", name: "Capitoons", url: "https://capitoons.com" },
  { id: "CovenScan", name: "Coven Scan", url: "https://covendasbruxonas.com" },
  { id: "EgoToons", name: "Ego Toons", url: "https://egotoons.com" },
  { id: "Fliptru", name: "Fliptru", url: "https://fliptru.com.br" },
  { id: "FlowerManga", name: "Flower Mangas", url: "https://flowermangas.net" },
  { id: "GalaxScans", name: "GALAX Scans", url: "https://galaxscanlator.blogspot.com" },
  { id: "GeassComics", name: "Geass Comics", url: "https://geasscomics.xyz" },
  { id: "HanmokkuScan", name: "Hanmokku Scan", url: "https://hanmokkuscan.blogspot.com" },
  { id: "HentaiHQ", name: "Hentai HQ", url: "https://hentaihq.net" },
  { id: "HentaiSeason", name: "Hentai Season", url: "https://hentaiseason.com" },
  { id: "HentaiTokyo", name: "Hentai Tokyo", url: "https://hentaitokyo.net" },
  { id: "Hipercool", name: "HipercooL / LerHentais", url: "https://lerhentais.com" },
  { id: "Hipertoon", name: "Hipertoon", url: "https://hipertoon.com", cloudflare: true },
  { id: "HoraHentai", name: "Hora Hentai", url: "https://horahentai.com" },
  { id: "HQHentai", name: "HQ Hentai", url: "https://hqhentai.online" },
  { id: "HQNow", name: "HQ Now", url: "https://www.hq-now.com" },
  { id: "HQPorno", name: "HQ Porno", url: "https://www.hqporno.net" },
  { id: "KamiSamaExplorer", name: "Kami Sama Explorer", url: "https://leitor.kamisama.com.br" },
  { id: "KuroMangas", name: "Kuro Mangás", url: "https://kuromangas.com" },
  { id: "LeituraManga", name: "Leitura Manga", url: "https://leituramanga.net" },
  { id: "Ler999", name: "Ler 999", url: "https://ler999.blogspot.com" },
  { id: "MangaDash", name: "MangaDash", url: "https://mangadash.net" },
  { id: "MangaDex", name: "MangaDex", url: "https://mangadex.org" },
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
  { id: "MonteTai", name: "Monte Tai", url: "https://montetaiscanlator.xyz" },
  { id: "MugiwarasOficial", name: "Mugiwaras Oficial", url: "https://mugiwarasoficial.org" },
  { id: "MuitoHentai", name: "Muito Hentai", url: "https://www.muitohentai.com" },
  { id: "MundoHentai", name: "Mundo Hentai", url: "https://mundohentaioficial.com" },
  { id: "NebulosaScan", name: "Nebulosa Scan", url: "https://nebulosascan.com" },
  { id: "NexusMangas", name: "Nexus Mangás", url: "https://www.nexusmangas.com" },
  { id: "NHentaiBR", name: "NHentai BR", url: "https://nhentaibr.com" },
  { id: "NinjaScan", name: "Ninja Scan", url: "https://ninjacomics.xyz" },
  { id: "OneReader", name: "OneReader", url: "https://onereader.net" },
  { id: "PizzariaScan", name: "Pizzaria Scan", url: "https://pizzariacomics.com" },
  { id: "PlumaComics", name: "Pluma Comics", url: "https://plumacomics.cloud" },
  { id: "RFDragonScan", name: "RF Dragon Scan", url: "https://rfdragonscan.net" },
  { id: "Roxinha", name: "Roxinha", url: "https://roxinha.online" },
  { id: "TaimuMangas", name: "Taimu Mangás", url: "https://beta.taimumangas.com" },
  { id: "Taiyo", name: "Taiyō", url: "https://taiyo.moe" },
  { id: "TankouHentai", name: "Tankou Hentai", url: "https://tankouhentai.com" },
  { id: "TaoSect", name: "Tao Sect", url: "https://taosect.com" },
  { id: "ToonBr", name: "ToonBr", url: "https://beta.toonbr.com" },
  { id: "TraducoesDoLipe", name: "Traduções do Lipe", url: "https://traducoesdolipe.blogspot.com" },
  { id: "Vegitoons", name: "Vegitoons", url: "https://vegitoons.black" },
  { id: "YomuComics", name: "Yomu Comics", url: "https://yomu.com.br" },
  { id: "YuriOnAir", name: "Yuri on Air", url: "https://yurionair.top" },
  { id: "ZettaHQ", name: "ZettaHQ", url: "https://zettahq.com" },
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
