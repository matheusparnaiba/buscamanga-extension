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

declare const App: any;

const BASE_URL = "https://hentaihq.net";
const IMAGE_FILTER = "";
const STRIP_THUMB_SUFFIX = false;

const SECTIONS: { id: string; title: string; path: string; type: DiscoverSectionType }[] = [
  {
    id: "updates",
    title: "Últimas Atualizações",
    path: "",
    type: DiscoverSectionType.chapterUpdates,
  },
  {
    id: "popular",
    title: "Mais Lidos",
    path: "/hq-de-sexo",
    type: DiscoverSectionType.prominentCarousel,
  },
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
  const match = href.match(/https?:\/\/[^/]+\/([^/?#]+)\/?$/);
  if (match?.[1]) {
    const slug = match[1];
    if (!["category", "tag", "page", "author", "delivery", "games", "animadas"].includes(slug)) {
      return slug;
    }
  }
  const clean = href.replace(/\/+$/, "").split("/").pop();
  return clean && !clean.includes("?") && !clean.includes("#") ? clean : undefined;
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
      contentRating: ContentRating.EVERYONE,
      subtitle: "18+",
    });
  };

  $(".thumb-conteudo").each((_, el) => {
    const a = $(el).find("a[href]").first();
    const img = $(el).find("img").first();
    const rawTitle =
      $(el).find(".thumb-titulo a, .thumb-titulo").first().text() ||
      a.attr("title") ||
      img.attr("alt") ||
      "";
    push(a.attr("href"), rawTitle, img);
  });

  return items;
}

function pageUrl(path: string, page: number): string {
  return page > 1 ? `${BASE_URL}${path}/page/${page}/` : `${BASE_URL}${path}/`;
}

export class HentaiHQExtension implements ExtensionImpl<typeof HentaiHQConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

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
      type: s.type,
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
    const cards = parseCards($);
    const items: DiscoverSectionItem[] = cards.map((item) => {
      if (section.type === DiscoverSectionType.chapterUpdates) {
        return {
          type: "chapterUpdatesCarouselItem",
          mangaId: item.mangaId,
          chapterId: item.mangaId,
          title: item.title,
          subtitle: "Capítulo Único",
          imageUrl: item.imageUrl,
          contentRating: ContentRating.EVERYONE,
        };
      }
      return {
        type: "prominentCarouselItem",
        mangaId: item.mangaId,
        title: item.title,
        imageUrl: item.imageUrl,
        contentRating: ContentRating.EVERYONE,
      };
    });

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

    const tagGroups: { id: string; title: string; tags: Tag[] }[] = [];
    const categories: Tag[] = [];
    const tags: Tag[] = [];
    const seenCat = new Set<string>();
    const seenTags = new Set<string>();

    $(".post-categorias a, .categoria a").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = sanitizeTagId(text);
      if (!text || seenCat.has(id)) return;
      seenCat.add(id);
      categories.push({ id, title: text });
    });

    $(".post-footer .post-tags a, .post-tags a").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = sanitizeTagId(text);
      if (!text || seenTags.has(id)) return;
      seenTags.add(id);
      tags.push({ id, title: text });
    });

    if (categories.length > 0)
      tagGroups.push({ id: "categories", title: "Categorias", tags: categories });
    if (tags.length > 0) tagGroups.push({ id: "tags", title: "Tags", tags });

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
        contentRating: ContentRating.EVERYONE,
        status: "COMPLETED",
        tagGroups,
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    let publishDate: Date | undefined;
    try {
      const $ = await fetchHtml(`${BASE_URL}/${sourceManga.mangaId}/`);
      const published =
        $("meta[property='article:modified_time']").attr("content") ||
        $("meta[property='article:published_time']").attr("content") ||
        $("time").first().attr("datetime");
      if (published) {
        const d = new Date(published);
        if (!isNaN(d.getTime())) publishDate = d;
      }
    } catch {
      // Ignora erro e prossegue com fallback
    }

    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: 1,
        title: "Capítulo Único",
        volume: 0,
        publishDate,
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

export const HentaiHQ = new HentaiHQExtension();
