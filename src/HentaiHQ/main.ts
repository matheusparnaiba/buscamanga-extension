import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type JSONValue,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { MainInterceptor } from "./network";
import type HentaiHQConfig from "./pbconfig";

const BASE_URL = "https://hentaihq.net";
const IMAGE_FILTER = "";
const STRIP_THUMB_SUFFIX = false;

const SECTIONS: { id: string; title: string; path: string }[] = [
  { id: "latest", title: "Atualizações", path: "" },
  { id: "hq-de-sexo", title: "HQ de Sexo", path: "/hq-de-sexo" },
  { id: "quadrinhos-eroticos", title: "Quadrinhos Eróticos", path: "/quadrinhos-eroticos" },
];

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Retorna o slug se o link pertence ao próprio site e tem um único segmento (/slug/). */
function slugFromUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, BASE_URL);
    if (url.host.replace(/^www\./, "") !== new URL(BASE_URL).host.replace(/^www\./, "")) {
      return undefined;
    }
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    return path && !path.includes("/") ? path : undefined;
  } catch {
    return undefined;
  }
}

function imageFrom($img: cheerio.Cheerio<any>): string {
  const candidates = [
    $img.attr("data-src"),
    $img.attr("data-lazy-src"),
    $img.attr("data-original"),
    $img.attr("src"),
  ];
  let src = (candidates.find((c) => c && !c.startsWith("data:")) ?? "").trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return src;
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const [, buffer] = await Application.scheduleRequest({ url, method: "GET" });
  return cheerio.load(Application.arrayBufferToUTF8String(buffer));
}

function parseCards($: cheerio.CheerioAPI): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  const push = (
    href: string | undefined,
    rawTitle: string | undefined,
    $img: cheerio.Cheerio<any>,
  ) => {
    const mangaId = slugFromUrl(href);
    const title = cleanTitle(rawTitle ?? "");
    if (!mangaId || !title || seen.has(mangaId)) return;
    seen.add(mangaId);
    items.push({
      mangaId,
      title,
      imageUrl: imageFrom($img),
      contentRating: ContentRating.ADULT,
    });
  };

  $(".thumb-conteudo").each((_, el) => {
    const a = $(el).find("a").first();
    const img = $(el).find("img").first();
    push(a.attr("href"), a.attr("title") || img.attr("alt"), img);
  });

  return items;
}

function pageUrl(path: string, page: number): string {
  return page > 1 ? `${BASE_URL}${path}/page/${page}/` : `${BASE_URL}${path}/`;
}

export class HentaiHQExtension implements ExtensionImpl<typeof HentaiHQConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 8,
    bufferInterval: 5,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      type: DiscoverSectionType.simpleCarousel,
    }));
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const def = SECTIONS.find((s) => s.id === section.id);
    if (!def) return { items: [] };

    const $ = await fetchHtml(pageUrl(def.path, page));
    const items: DiscoverSectionItem[] = parseCards($).map((item) => ({
      type: "simpleCarouselItem",
      mangaId: item.mangaId,
      title: item.title,
      imageUrl: item.imageUrl,
      contentRating: ContentRating.ADULT,
    }));

    return { items, metadata: items.length > 0 ? page + 1 : undefined };
  }

  async getSearchResults(
    query: SearchQuery<JSONValue>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const term = encodeURIComponent(query.title ?? "");
    const url = page > 1 ? `${BASE_URL}/page/${page}/?s=${term}` : `${BASE_URL}/?s=${term}`;

    const items = parseCards(await fetchHtml(url));
    return { items, metadata: items.length > 0 ? page + 1 : undefined };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const $ = await fetchHtml(url);

    const title = cleanTitle($("h1").first().text());
    const cover = $("meta[property='og:image']").attr("content") || undefined;

    const tags: Tag[] = [];
    const seenTags = new Set<string>();
    $(".post-footer .post-tags a").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = sanitizeTagId(text);
      if (!text || seenTags.has(id)) return;
      seenTags.add(id);
      tags.push({ id, title: text });
    });

    const synopsis = cleanTitle($(".post-texto p").first().text());

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title || mangaId,
        secondaryTitles: [],
        thumbnailUrl:
          cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title || "Hentai HQ")}&background=random`,
        synopsis,
        contentRating: ContentRating.ADULT,
        status: "COMPLETED",
        tagGroups: tags.length > 0 ? [{ id: "tags", title: "Tags", tags }] : [],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: 1,
        title: "Capítulo Único",
        volume: 0,
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const $ = await fetchHtml(`${BASE_URL}/${chapter.chapterId}/`);

    const pages: string[] = [];
    $(".post-texto img").each((_, img) => {
      let src = imageFrom($(img));
      if (STRIP_THUMB_SUFFIX) src = src.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
      if (!src || (IMAGE_FILTER && !src.includes(IMAGE_FILTER))) return;
      if (!pages.includes(src)) pages.push(src);
    });

    if (pages.length === 0) {
      throw new Error("Nenhuma página encontrada para este conteúdo.");
    }

    return { id: chapter.chapterId, mangaId: chapter.sourceManga.mangaId, pages };
  }
}

export const HentaiHQ = new HentaiHQExtension();
