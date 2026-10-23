import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type Form,
  type JSONValue,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { SettingsForm } from "./forms";
import { MainInterceptor } from "./network";
import type MuitoHentaiConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://www.muitohentai.com";

/** `page` é a página atual (1-based); o site pagina com `/<path>/N`. */
const SECTIONS: { id: string; title: string; path: string; type: DiscoverSectionType }[] = [
  {
    id: "updates",
    title: "Últimas Atualizações",
    path: "/mangas",
    type: DiscoverSectionType.chapterUpdates,
  },
  {
    id: "popular",
    title: "Mais Lidos",
    path: "/mangas/genero/creampie",
    type: DiscoverSectionType.prominentCarousel,
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sanitizeTagId(raw: string): string {
  return (
    normalize(raw)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

function slugFromUrl(href: string): string | undefined {
  return href.match(/\/hentai-manga\/([^/?#]+)/)?.[1];
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const [, buffer] = await Application.scheduleRequest({ url, method: "GET" });
  return cheerio.load(Application.arrayBufferToUTF8String(buffer));
}

function parseCards($: cheerio.CheerioAPI): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  $(".data h3 a").each((_, el) => {
    const mangaId = slugFromUrl($(el).attr("href") ?? "");
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!mangaId || !title || seen.has(mangaId)) return;
    seen.add(mangaId);

    let img = $(el).closest(".data").prev(".poster").find("img").first().attr("src");
    if (!img) img = `https://mangaz.muitohentai.club/posters/${mangaId}.jpg`;
    if (img.startsWith("//")) img = "https:" + img;
    else if (img.startsWith("http://")) img = img.replace(/^http:\/\//i, "https://");

    items.push({
      mangaId,
      title,
      imageUrl: img,
      contentRating: ContentRating.EVERYONE,
      subtitle: "18+",
    });
  });

  return items;
}

function pageUrl(path: string, page: number): string {
  return page > 1 ? `${BASE_URL}${path}/${page}/` : `${BASE_URL}${path}/`;
}

export class MuitoHentaiExtension implements ExtensionImpl<typeof MuitoHentaiConfig> {
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

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
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

  /**
   * A busca nativa do site (`/buscar/`) só cobre os animes, então a busca de mangás usa
   * o índice alfabético (`/mangas/letra/<inicial>/`) e filtra os títulos localmente.
   */
  async getSearchResults(
    query: SearchQuery<JSONValue>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const term = normalize(query.title ?? "");
    if (!term || metadata !== undefined) return { items: [] };

    const first = term[0] ?? "";
    const letter = /[a-z]/.test(first) ? first : "0-9";
    const $ = await fetchHtml(`${BASE_URL}/mangas/letra/${letter}/`);

    const items = parseCards($).filter((item) => normalize(item.title).includes(term));
    return { items };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/hentai-manga/${mangaId}/`;
    const $ = await fetchHtml(url);

    const title = $("h1.titlebars").first().text().trim() || $("h1").first().text().trim();
    let cover =
      $("#capaAnime img").first().attr("src") ||
      `https://mangaz.muitohentai.club/posters/${mangaId}.jpg`;
    if (cover.startsWith("//")) cover = "https:" + cover;
    else if (cover.startsWith("http://")) cover = cover.replace(/^http:\/\//i, "https://");

    const genres: Tag[] = [];
    $("a.genero_btn").each((_, a) => {
      const text = $(a).text().trim();
      if (text) genres.push({ id: sanitizeTagId(text), title: text });
    });

    let author: string | undefined;
    $("#capaAnime")
      .next()
      .children("div")
      .each((_, div) => {
        const text = $(div).text().replace(/\s+/g, " ").trim();
        const match = text.match(/^Autor\s*:\s*(.+)$/i);
        if (match?.[1]) author = match[1].trim();
      });

    const synopsis = ($("meta[name=description]").attr("content") ?? "").trim();

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title || mangaId,
        secondaryTitles: [],
        thumbnailUrl: cover,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "COMPLETED",
        author,
        tagGroups: genres.length ? [{ id: "genres", title: "Gêneros", tags: genres }] : [],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const $ = await fetchHtml(`${BASE_URL}/hentai-manga/${sourceManga.mangaId}/`);
    const chapters: Chapter[] = [];
    const seen = new Set<string>();

    $("a[href*='/manga/']").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      const match = href.match(/\/manga\/([^/]+)\/capitulo-([\w.-]+)/);
      if (!match || match[1] !== sourceManga.mangaId) return;

      const chapterId = `${match[1]}/capitulo-${match[2]}`;
      if (seen.has(chapterId)) return;
      seen.add(chapterId);

      const num = parseFloat((match[2] ?? "").replace("-", "."));
      const itemEl = $(a).closest("li, tr, div, p");
      const rawDate =
        itemEl.find(".date, time, .created-at, small, span").first().text().trim() ||
        $("meta[property='article:modified_time']").attr("content") ||
        $("meta[property='article:published_time']").attr("content");
      let publishDate: Date | undefined;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) publishDate = d;
      }

      chapters.push({
        chapterId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: Number.isNaN(num) ? chapters.length + 1 : num,
        title: $(a).text().replace(/\s+/g, " ").trim() || `Capítulo ${match[2]}`,
        volume: 0,
        publishDate,
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const cleanId = chapter.chapterId.replace(/^\/+|\/+$/g, "");
    const [, buffer] = await Application.scheduleRequest({
      url: `${BASE_URL}/manga/${cleanId}/`,
      method: "GET",
    });
    const html = Application.arrayBufferToUTF8String(buffer);

    // A primeira página fica no <img> do leitor e as demais em `var arr = [...]`;
    // ambos apontam para <slug>/<capítulo>/<n>.<ext>, então basta extrair e ordenar.
    const found = new Map<number, string>();
    const regex = /(?:https?:)?\/\/[^"'\s\\]+\/(\d+)\.(?:jpe?g|png|webp)(?:\?[^"'\s\\]*)?/gi;
    for (const match of html.matchAll(regex)) {
      let url = match[0];
      if (!url.includes("/mangas/")) continue;
      if (url.startsWith("//")) url = "https:" + url;
      else if (url.startsWith("http://")) url = url.replace(/^http:\/\//i, "https://");
      const index = parseInt(match[1] ?? "", 10);
      if (!found.has(index)) found.set(index, url);
    }

    const pages = [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, url]) => url);
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

export const MuitoHentai = new MuitoHentaiExtension();
