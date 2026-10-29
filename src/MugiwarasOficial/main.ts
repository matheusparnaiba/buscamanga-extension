import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type AdvancedSearchForm,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type Form,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { MugiwarasSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type MugiwarasConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://mugiwarasoficial.org";

// Pure TypeScript SHA-256 and HMAC-SHA256 for cross-platform decryption
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256(message: Uint8Array): Uint8Array {
  let H0 = 0x6a09e667,
    H1 = 0xbb67ae85,
    H2 = 0x3c6ef372,
    H3 = 0xa54ff53a;
  let H4 = 0x510e527f,
    H5 = 0x9b05688c,
    H6 = 0x1f83d9ab,
    H7 = 0x5be0cd19;

  const msgLen = message.length;
  const bitLen = BigInt(msgLen) * 8n;
  const padLen = msgLen % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
  const totalLen = msgLen + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(message);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setBigUint64(totalLen - 8, bitLen, false);

  const W = new Int32Array(64);

  for (let chunk = 0; chunk < totalLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getInt32(chunk + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15]!, 7) ^ rotr(W[i - 15]!, 18) ^ (W[i - 15]! >>> 3);
      const s1 = rotr(W[i - 2]!, 17) ^ rotr(W[i - 2]!, 19) ^ (W[i - 2]! >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
    }

    let a = H0,
      b = H1,
      c = H2,
      d = H3,
      e = H4,
      f = H5,
      g = H6,
      h = H7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + W[i]!) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const outView = new DataView(result.buffer);
  outView.setInt32(0, H0, false);
  outView.setInt32(4, H1, false);
  outView.setInt32(8, H2, false);
  outView.setInt32(12, H3, false);
  outView.setInt32(16, H4, false);
  outView.setInt32(20, H5, false);
  outView.setInt32(24, H6, false);
  outView.setInt32(28, H7, false);
  return result;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k: Uint8Array = key;
  if (k.length > 64) {
    k = sha256(k);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(k);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i]! ^ 0x5c;
    iKeyPad[i] = paddedKey[i]! ^ 0x36;
  }

  const innerMsg = new Uint8Array(64 + message.length);
  innerMsg.set(iKeyPad, 0);
  innerMsg.set(message, 64);
  const innerHash = sha256(innerMsg);

  const outerMsg = new Uint8Array(64 + 32);
  outerMsg.set(oKeyPad, 0);
  outerMsg.set(innerHash, 64);
  return sha256(outerMsg);
}

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getParams(payload: string): { v: number; e: number } {
  const buf = base64UrlToBytes(payload);
  const v = buf[0]! > 127 ? buf[0]! - 256 : buf[0]!;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const e = view.getInt32(1, false);
  return { v, e };
}

function decryptAurora(payload: string, keyB64: string): string {
  const bytes = base64UrlToBytes(payload);
  const baseData = bytes.subarray(5, 13);
  const cipherText = bytes.subarray(13);
  const totalLength = cipherText.length;
  const chapterKey = base64ToBytes(keyB64);

  const keystream = new Uint8Array(totalLength);
  let o = 0;
  let i = 0;

  while (o < totalLength) {
    const block = new Uint8Array(baseData.length + 1);
    block.set(baseData, 0);
    block[baseData.length] = i & 0xff;

    const hashBlock = hmacSha256(chapterKey, block);
    const copyLen = Math.min(hashBlock.length, totalLength - o);
    keystream.set(hashBlock.subarray(0, copyLen), o);
    o += copyLen;
    i++;
  }

  const decrypted = new Uint8Array(totalLength);
  for (let idx = 0; idx < totalLength; idx++) {
    decrypted[idx] = cipherText[idx]! ^ keystream[idx]!;
  }

  return new TextDecoder("utf-8").decode(decrypted);
}

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src = $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("src") || "";

  if (!src) {
    const srcset = $img.attr("srcset") || $img.attr("data-srcset");
    if (srcset) {
      src = srcset.split(",")[0]?.trim()?.split(" ")[0]?.trim() || "";
    }
  }

  src = src.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return src;
}

function parsePortugueseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const str = dateStr
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const now = new Date();

  if (
    str.includes("agora") ||
    str.includes("just now") ||
    str.includes("segundo") ||
    str.includes("hoje")
  ) {
    return now;
  }

  if (str.includes("ontem")) {
    return new Date(now.getTime() - 86400 * 1000);
  }

  const months: Record<string, number> = {
    jan: 0,
    fev: 1,
    mar: 2,
    abr: 3,
    mai: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    set: 8,
    out: 9,
    nov: 10,
    dez: 11,
  };

  const match = str.match(/(\d{1,2})\s+de\s+([a-z]{3})[a-z]*\.?\s+de\s+(\d{4})/);
  if (match?.[1] && match[2] && match[3]) {
    const m = months[match[2]];
    if (m !== undefined) {
      return new Date(parseInt(match[3], 10), m, parseInt(match[1], 10));
    }
  }

  const slashMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    return new Date(
      parseInt(slashMatch[3], 10),
      parseInt(slashMatch[2], 10) - 1,
      parseInt(slashMatch[1], 10),
    );
  }

  return undefined;
}

export class MugiwarasOficialExtension implements ExtensionImpl<typeof MugiwarasConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 5,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Mais Lidos & Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const _page = metadata ?? 1;
    const url = section.id === "popular" ? `${BASE_URL}/catalogo` : `${BASE_URL}/novidades`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $("a[href*='/manga/'], a[href*='/obra/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      const mMatch = href.match(/\/(?:manga|obra)\/([^/]+)/);
      if (!mMatch?.[1]) return;
      const mangaId = mMatch[1];
      if (seenIds.has(mangaId)) return;

      const img = getImageSrc($(el).find("img").first());
      const title =
        $(el).find("h2, h3, h4, span.font-semibold, .title").first().text().trim() ||
        $(el).attr("title")?.trim() ||
        mangaId.replace(/-/g, " ");

      if (!title) return;
      seenIds.add(mangaId);

      const subtitle = $(el).find(".chapter, .capitulo, span.text-xs").first().text().trim();

      if (section.id === "popular") {
        items.push({
          mangaId,
          title,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      } else {
        items.push({
          mangaId,
          chapterId: mangaId,
          title,
          subtitle: subtitle || undefined,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
          type: "chapterUpdatesCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }
    });

    return {
      items,
      metadata: undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "views" },
    });
  }

  async getSearchResults(
    query: SearchQuery<MugiwarasSearchMetadata>,
    _metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const titleFilter = query.title?.trim().toLowerCase() ?? "";
    const genreFilter =
      query.metadata?.genre && query.metadata.genre !== "all"
        ? query.metadata.genre.toLowerCase()
        : "";

    const url = `${BASE_URL}/catalogo`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("a[href*='/manga/'], a[href*='/obra/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      const mMatch = href.match(/\/(?:manga|obra)\/([^/]+)/);
      if (!mMatch?.[1]) return;
      const mangaId = mMatch[1];
      if (seenIds.has(mangaId)) return;

      const title =
        $(el).find("h2, h3, h4, span.font-semibold, .title").first().text().trim() ||
        $(el).attr("title")?.trim() ||
        mangaId.replace(/-/g, " ");

      if (titleFilter && !title.toLowerCase().includes(titleFilter)) return;
      if (genreFilter && !$(el).text().toLowerCase().includes(genreFilter)) return;

      seenIds.add(mangaId);
      const img = getImageSrc($(el).find("img").first());

      items.push({
        mangaId,
        title,
        imageUrl:
          img ||
          "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
        contentRating: ContentRating.EVERYONE,
      });
    });

    return {
      items,
      metadata: undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      mangaId.replace(/-/g, " ");

    const image =
      $('meta[property="og:image"]').attr("content") ||
      getImageSrc($("img.cover, .cover img, img").first());
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $('meta[property="og:description"]').attr("content") ||
      $(".synopsis, .description, p.text-sm").first().text().trim() ||
      "";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $("a[href*='/genero/'], a[href*='/categoria/'], span.badge").each((_, el) => {
      const g = $(el).text().trim();
      if (g) {
        const id = g.toLowerCase().replace(/\s+/g, "-");
        if (!seenGenres.has(id)) {
          seenGenres.add(id);
          genres.push({ id, title: g });
        }
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "ongoing",
        author: "Mugiwaras",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId;
    const url = `${BASE_URL}/manga/${slug}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const chapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      const chapRegex = new RegExp(`/(?:manga|obra)/${slug}/([^/?#]+)`);
      const match = href.match(chapRegex);
      if (!match?.[1] || match[1] === "ler") return;

      const chapIdStr = match[1];
      if (seenChapters.has(chapIdStr)) return;
      seenChapters.add(chapIdStr);

      const text = $(el).text().trim();
      const numMatch = chapIdStr.match(/(\d+(?:[.,]\d+)?)/) || text.match(/(\d+(?:[.,]\d+)?)/);
      const chapNum = numMatch ? parseFloat(numMatch[1]!.replace(",", ".")) : 0;

      const publishDate = parsePortugueseDate(text);

      chapters.push({
        chapterId: `/manga/${slug}/${chapIdStr}`,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title: text || `Capítulo ${chapNum}`,
        volume: 0,
        publishDate,
      });
    });

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterPath = chapter.chapterId.startsWith("http")
      ? new URL(chapter.chapterId).pathname
      : chapter.chapterId;

    // 1. Unlock reader
    let cookieHeader = "mnx_adulto=1";
    try {
      const unlockReq = {
        url: `${BASE_URL}/api/reader/unlock`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: `${BASE_URL}${chapterPath}`,
          Origin: BASE_URL,
        },
        body: JSON.stringify({ returnTo: chapterPath }),
      };
      const [unlockRes, _] = await Application.scheduleRequest(unlockReq);
      const setCookies = (unlockRes as any).headers?.["set-cookie"] || "";
      if (setCookies) {
        const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
        const parsedCookies = cookieStrings
          .map((c: string) => c.split(";")[0])
          .filter(Boolean)
          .join("; ");
        if (parsedCookies) {
          cookieHeader = `${parsedCookies}; ${cookieHeader}`;
        }
      }
    } catch (e) {
      console.error("Erro ao solicitar unlock:", e);
    }

    // 2. Fetch RSC chapter data
    const pageReq = {
      url: `${BASE_URL}${chapterPath}`,
      method: "GET",
      headers: {
        rsc: "1",
        Referer: `${BASE_URL}/manga/${chapter.sourceManga.mangaId}`,
        Cookie: cookieHeader,
      },
    };

    const [_, pageBuf] = await Application.scheduleRequest(pageReq);
    const pageData = Application.arrayBufferToUTF8String(pageBuf);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    const pagesMatch = pageData.match(/"pages"\s*:\s*(\[[^\]]+\])/);
    if (pagesMatch?.[1]) {
      try {
        const parsedPages = JSON.parse(pagesMatch[1]);
        let cachedKey = "";

        for (const item of parsedPages) {
          const rawUrl = item.url;
          if (!rawUrl) continue;

          if (rawUrl.startsWith("http")) {
            if (!seenPages.has(rawUrl)) {
              seenPages.add(rawUrl);
              pages.push(rawUrl);
            }
          } else {
            // Encrypted payload
            try {
              if (!cachedKey) {
                const { v, e } = getParams(rawUrl);
                const keyReq = {
                  url: `${BASE_URL}/api/atfield/key?v=${v}&e=${e}`,
                  method: "GET",
                  headers: {
                    Referer: `${BASE_URL}${chapterPath}`,
                    Cookie: cookieHeader,
                  },
                };
                const [__, keyBuf] = await Application.scheduleRequest(keyReq);
                const keyData = JSON.parse(Application.arrayBufferToUTF8String(keyBuf));
                cachedKey = keyData.k || "";
              }

              if (cachedKey) {
                const decrypted = decryptAurora(rawUrl, cachedKey);
                if (decrypted && decrypted.startsWith("http") && !seenPages.has(decrypted)) {
                  seenPages.add(decrypted);
                  pages.push(decrypted);
                }
              }
            } catch (decErr) {
              console.error("Erro ao descriptografar imagem:", decErr);
            }
          }
        }
      } catch (jsonErr) {
        console.error("Erro ao parsear páginas do JSON:", jsonErr);
      }
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }

  async getHomePageSections(sectionCallback: (section: any) => void): Promise<void> {
    const sections = await this.getDiscoverSections();
    const appGlobal = (typeof App !== "undefined" ? App : undefined) as any;
    for (const sec of sections) {
      const homeSection =
        appGlobal && appGlobal.createHomeSection
          ? appGlobal.createHomeSection({
              id: sec.id,
              title: sec.title,
              containsMoreItems: true,
              type: "singleRowNormal",
            })
          : {
              id: sec.id,
              title: sec.title,
              containsMoreItems: true,
              type: "singleRowNormal",
              items: [],
            };

      sectionCallback(homeSection);

      try {
        const paged = await this.getDiscoverSectionItems(sec, undefined);
        const mangaItems: any[] = [];
        for (const item of paged.items) {
          const rawItem = item as any;
          const m =
            appGlobal && appGlobal.createPartialSourceManga
              ? appGlobal.createPartialSourceManga({
                  mangaId: rawItem.mangaId || "",
                  image: rawItem.imageUrl || "",
                  title: rawItem.title || "",
                  subtitle: rawItem.subtitle,
                })
              : {
                  mangaId: rawItem.mangaId || "",
                  image: rawItem.imageUrl || "",
                  title: rawItem.title || "",
                  subtitle: rawItem.subtitle,
                };
          mangaItems.push(m);
        }
        homeSection.items = mangaItems;
        sectionCallback(homeSection);
      } catch (e) {
        console.error(`Erro ao carregar seção ${sec.title}:`, e);
      }
    }
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<any> {
    const sections = await this.getDiscoverSections();
    const sec = sections.find((s) => s.id === homepageSectionId) || {
      id: homepageSectionId,
      title: homepageSectionId,
    };
    const paged = await this.getDiscoverSectionItems(sec as any, metadata);
    const appGlobal = (typeof App !== "undefined" ? App : undefined) as any;
    const results: any[] = [];
    for (const item of paged.items) {
      const rawItem = item as any;
      const m =
        appGlobal && appGlobal.createPartialSourceManga
          ? appGlobal.createPartialSourceManga({
              mangaId: rawItem.mangaId || "",
              image: rawItem.imageUrl || "",
              title: rawItem.title || "",
              subtitle: rawItem.subtitle,
            })
          : {
              mangaId: rawItem.mangaId || "",
              image: rawItem.imageUrl || "",
              title: rawItem.title || "",
              subtitle: rawItem.subtitle,
            };
      results.push(m);
    }
    return appGlobal && appGlobal.createPagedResults
      ? appGlobal.createPagedResults({ results, metadata: paged.metadata })
      : { results, metadata: paged.metadata };
  }
}

export const MugiwarasOficial = new MugiwarasOficialExtension();
