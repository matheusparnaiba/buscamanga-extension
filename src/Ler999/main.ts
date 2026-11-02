/* SPDX-License-Identifier: GPL-3.0-or-later */
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
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://ler999.blogspot.com";
const MANGA_CATEGORY = "Series";
const CHAPTER_CATEGORY = "Chapter";

interface BloggerCategory {
  term: string;
}

interface BloggerLink {
  rel: string;
  href: string;
}

interface BloggerEntry {
  title?: { $t?: string };
  published?: { $t?: string };
  updated?: { $t?: string };
  category?: BloggerCategory[];
  link?: BloggerLink[];
  content?: { $t?: string };
  media$thumbnail?: { url?: string };
}

interface BloggerFeedResponse {
  feed?: {
    entry?: BloggerEntry[];
  };
}

interface SeriesInfo {
  title: string;
  link: string;
  thumb: string;
}

let seriesMapCache: Map<string, SeriesInfo> | null = null;
let lastSeriesMapFetch = 0;

async function getSeriesMap(): Promise<Map<string, SeriesInfo>> {
  const now = Date.now();
  if (seriesMapCache && now - lastSeriesMapFetch < 300000) {
    return seriesMapCache;
  }

  const map = new Map<string, SeriesInfo>();
  try {
    const url = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}?alt=json&max-results=50`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: BloggerFeedResponse = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const entries = json.feed?.entry ?? [];

    for (const e of entries) {
      const title = e.title?.$t?.trim() || "Sem título";
      const link = e.link?.find((l) => l.rel === "alternate")?.href || "";
      if (!link) continue;

      const thumb =
        cleanThumbnail(e.media$thumbnail?.url) ||
        extractFirstImgFromHtml(e.content?.$t) ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

      const info: SeriesInfo = { title, link, thumb };
      map.set(title.toLowerCase(), info);

      (e.category || []).forEach((c) => {
        const term = c.term?.trim();
        if (
          term &&
          term !== "Series" &&
          term !== "Project" &&
          term !== "Update" &&
          !/^\d+(\.\d+)?$/.test(term) &&
          !["manhwa", "manhua", "manga", "ongoing", "hiatus", "dropped", "completed"].includes(
            term.toLowerCase(),
          )
        ) {
          map.set(term.toLowerCase(), info);
        }
      });
    }

    seriesMapCache = map;
    lastSeriesMapFetch = now;
  } catch (err) {
    console.error("Erro ao obter mapa de séries Ler999:", err);
  }
  return map;
}

function cleanThumbnail(url: string | undefined): string {
  if (!url) return "";
  let src = url
    .replace(/\/s\d+(-c)?\//g, "/w600/")
    .replace(/\/s\d+-w\d+-c-h\d+\//g, "/w600/")
    .replace(/=s\d+(-c)?$/g, "=w600");
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

function extractFirstImgFromHtml(html: string | undefined): string {
  if (!html) return "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  let src = match && match[1] ? match[1] : "";
  if (!src) return "";
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-zA-Z0-9._\-@()[\]%?#+=/&:]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

export class Ler999Extension implements ExtensionImpl<typeof ContentTemplateConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "published", type: "all", genre: "all", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Popular Agora",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "manhuas",
        title: "Manhuas",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "manhwas",
        title: "Manhwas",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "mangas",
        title: "Mangás",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "action",
        title: "Ação & Aventura",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "martial-arts",
        title: "Cultivo & Artes Marciais",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "fantasy",
        title: "Fantasia",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "all",
        title: "Todas as Obras",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const startIndex = (page - 1) * 20 + 1;

    try {
      if (section.id === "updates") {
        const feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(CHAPTER_CATEGORY)}?alt=json&orderby=published&start-index=${startIndex}&max-results=25`;
        const [_, buffer] = await Application.scheduleRequest({ url: feedUrl, method: "GET" });
        const json: BloggerFeedResponse = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        const entries = json.feed?.entry ?? [];
        const seriesMap = await getSeriesMap();

        const items: DiscoverSectionItem[] = [];
        const seenMangaIds = new Set<string>();

        for (const entry of entries) {
          const chapterTitle = entry.title?.$t?.trim() || "Capítulo";
          const chapterLink = entry.link?.find((l) => l.rel === "alternate")?.href || "";
          if (!chapterLink) continue;

          let seriesInfo: SeriesInfo | undefined;
          for (const cat of entry.category || []) {
            const term = cat.term?.trim().toLowerCase();
            if (term && seriesMap.has(term)) {
              seriesInfo = seriesMap.get(term);
              break;
            }
          }

          if (seriesInfo) {
            if (seenMangaIds.has(seriesInfo.link)) continue;
            seenMangaIds.add(seriesInfo.link);

            items.push({
              mangaId: seriesInfo.link,
              chapterId: chapterLink,
              title: seriesInfo.title,
              subtitle: chapterTitle,
              imageUrl: seriesInfo.thumb,
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        }

        const hasNextPage = entries.length >= 25;
        return {
          items,
          metadata: hasNextPage ? page + 1 : undefined,
        };
      }

      let feedUrl: string;
      if (section.id === "popular") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}?alt=json&orderby=published&start-index=1&max-results=10`;
      } else if (section.id === "manhuas") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Manhua?alt=json&start-index=${startIndex}&max-results=21`;
      } else if (section.id === "manhwas") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Manhwa?alt=json&start-index=${startIndex}&max-results=21`;
      } else if (section.id === "mangas") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Manga?alt=json&start-index=${startIndex}&max-results=21`;
      } else if (section.id === "action") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Action?alt=json&start-index=${startIndex}&max-results=21`;
      } else if (section.id === "martial-arts") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Martial%20Arts?alt=json&start-index=${startIndex}&max-results=21`;
      } else if (section.id === "fantasy") {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/Fantasy?alt=json&start-index=${startIndex}&max-results=21`;
      } else {
        feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}?alt=json&orderby=published&start-index=${startIndex}&max-results=21`;
      }

      const [_, buffer] = await Application.scheduleRequest({ url: feedUrl, method: "GET" });
      const json: BloggerFeedResponse = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const entries = json.feed?.entry ?? [];
      const items: DiscoverSectionItem[] = [];

      for (const entry of entries) {
        const title = entry.title?.$t?.trim() || "Sem título";
        const link = entry.link?.find((l) => l.rel === "alternate")?.href || "";
        if (!link) continue;

        const thumb =
          cleanThumbnail(entry.media$thumbnail?.url) ||
          extractFirstImgFromHtml(entry.content?.$t) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        if (section.id === "popular") {
          items.push({
            mangaId: link,
            title,
            imageUrl: thumb,
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else {
          items.push({
            mangaId: link,
            title,
            imageUrl: thumb,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      const hasNextPage = items.length > 20;
      if (hasNextPage) {
        items.pop();
      }

      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção Ler999 ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const startIndex = (page - 1) * 20 + 1;
    const titleQuery = query.title?.trim() ?? "";
    const orderBy = query.metadata?.orderBy ?? "published";
    const type = query.metadata?.type;
    const genre = query.metadata?.genre;
    const status = query.metadata?.status;

    let feedUrl: string;
    if (titleQuery) {
      feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}?alt=json&q=${encodeURIComponent(titleQuery)}&start-index=${startIndex}&max-results=21`;
    } else if (type && type !== "all") {
      feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/${encodeURIComponent(type)}?alt=json&orderby=${orderBy}&start-index=${startIndex}&max-results=21`;
    } else if (genre && genre !== "all") {
      feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/${encodeURIComponent(genre)}?alt=json&orderby=${orderBy}&start-index=${startIndex}&max-results=21`;
    } else if (status && status !== "all") {
      feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}/${encodeURIComponent(status)}?alt=json&orderby=${orderBy}&start-index=${startIndex}&max-results=21`;
    } else {
      feedUrl = `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(MANGA_CATEGORY)}?alt=json&orderby=${orderBy}&start-index=${startIndex}&max-results=21`;
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({ url: feedUrl, method: "GET" });
      const json: BloggerFeedResponse = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const entries = json.feed?.entry ?? [];
      const items: SearchResultItem[] = [];

      for (const entry of entries) {
        const title = entry.title?.$t?.trim() || "Sem título";
        const link = entry.link?.find((l) => l.rel === "alternate")?.href || "";
        if (!link) continue;

        const thumb =
          cleanThumbnail(entry.media$thumbnail?.url) ||
          extractFirstImgFromHtml(entry.content?.$t) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId: link,
          title,
          imageUrl: thumb,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = items.length > 20;
      if (hasNextPage) {
        items.pop();
      }

      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca Ler999:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = mangaId.startsWith("http")
      ? mangaId
      : `${BASE_URL}${mangaId.startsWith("/") ? "" : "/"}${mangaId}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = (
      $("h1.entry-title, h1.post-title, .post-title, h1").first().text() || "Sem título"
    ).trim();

    const rawThumb =
      $(".post-body img, .entry-content img, .thumb img, .animecover img, #cover img")
        .first()
        .attr("src") || $('meta[property="og:image"]').attr("content");
    const thumbnailUrl =
      cleanThumbnail(rawThumb) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const synopsis = (
      $("#synopsis, .synopsis, #syn_bod, .entry-content, .post-body").first().text() ||
      $('meta[property="og:description"]').attr("content") ||
      ""
    ).trim();

    const author =
      $("span#author, li:contains('Author') > span, li:contains('Autor') > span")
        .first()
        .text()
        .trim() || "Ler 999";
    const artist =
      $("span#artist, li:contains('Artist') > span, li:contains('Artista') > span")
        .first()
        .text()
        .trim() || author;

    const statusText = (
      $("span[data-status], .status, span.dt:contains('Ongoing'), span.dt:contains('Completed')")
        .first()
        .text() || ""
    ).toLowerCase();
    const status =
      statusText.includes("completo") ||
      statusText.includes("finalizado") ||
      statusText.includes("completed")
        ? "completed"
        : "ongoing";

    const genreTags: Tag[] = [];
    const seenGenres = new Set<string>();

    $("div.mt-15 > a[rel='tag'], a[rel='tag'], a[href*='/search/label/'], .genres a").each(
      (_, el) => {
        const g = $(el).text().trim();
        const lower = g.toLowerCase();
        if (
          g &&
          !seenGenres.has(lower) &&
          !["series", "chapter", "capitulo", "capítulo", "news", "update", "project"].includes(
            lower,
          ) &&
          !lower.startsWith("score") &&
          !/^\d+(\.\d+)?$/.test(g)
        ) {
          seenGenres.add(lower);
          genreTags.push({ id: sanitizeTagId(g), title: g });
        }
      },
    );

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        artist,
        tagGroups:
          genreTags.length > 0 ? [{ id: "genres", title: "Gêneros", tags: genreTags }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaUrl = sourceManga.mangaId.startsWith("http")
      ? sourceManga.mangaId
      : `${BASE_URL}${sourceManga.mangaId.startsWith("/") ? "" : "/"}${sourceManga.mangaId}`;

    const [_, buffer] = await Application.scheduleRequest({ url: mangaUrl, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const clwdMatch = html.match(/clwd\.run\((["'])(.*?)\1\)/);
    const latestMatch = html.match(/label\s*=\s*(["'])(.*?)\1/);
    const catProjectMatch = html.match(/catNameProject\s*=\s*(["'])(.*?)\1/);
    const labelChap = $(".chapter_get").attr("data-labelchapter")?.trim();

    const projectLabel =
      clwdMatch?.[2] ||
      latestMatch?.[2] ||
      labelChap ||
      catProjectMatch?.[2] ||
      sourceManga.mangaInfo?.primaryTitle;

    let entries: BloggerEntry[] = [];

    const candidates = [
      projectLabel
        ? `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(CHAPTER_CATEGORY)}/${encodeURIComponent(projectLabel)}?alt=json&max-results=150`
        : null,
      projectLabel
        ? `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(projectLabel)}?alt=json&max-results=150`
        : null,
      sourceManga.mangaInfo?.primaryTitle
        ? `${BASE_URL}/feeds/posts/default/-/${encodeURIComponent(CHAPTER_CATEGORY)}/${encodeURIComponent(sourceManga.mangaInfo.primaryTitle)}?alt=json&max-results=150`
        : null,
    ].filter((u): u is string => Boolean(u));

    for (const url of candidates) {
      try {
        const [__, feedBuf] = await Application.scheduleRequest({ url, method: "GET" });
        const json: BloggerFeedResponse = JSON.parse(Application.arrayBufferToUTF8String(feedBuf));
        const resEntries = json.feed?.entry ?? [];
        if (resEntries.length > 0) {
          entries = resEntries;
          break;
        }
      } catch {
        // Continue trying next candidate
      }
    }

    const chapters: Chapter[] = [];
    const seenLinks = new Set<string>();

    for (const entry of entries) {
      const link = entry.link?.find((l) => l.rel === "alternate")?.href || "";
      if (!link || seenLinks.has(link)) continue;
      seenLinks.add(link);

      const title = entry.title?.$t?.trim() || "Capítulo";
      const numMatch = title.match(/(\d+(\.\d+)?)/);
      const chapNum = numMatch ? parseFloat(numMatch[1] as string) : 0;

      let publishDate: Date | undefined;
      const dateStr = entry.published?.$t || entry.updated?.$t;
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: link,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title,
        volume: 0,
        publishDate,
      });
    }

    if (chapters.length === 0) {
      $("a[href*='/20']").each((_, el) => {
        const href = $(el).attr("href")?.trim();
        const text = $(el).text().trim();
        if (
          href &&
          href.includes(".html") &&
          !seenLinks.has(href) &&
          (text.toLowerCase().includes("capítulo") ||
            text.toLowerCase().includes("chapter") ||
            text.toLowerCase().includes("ler"))
        ) {
          seenLinks.add(href);
          const numMatch = text.match(/(\d+(\.\d+)?)/);
          const chapNum = numMatch ? parseFloat(numMatch[1] as string) : 0;
          chapters.push({
            chapterId: href,
            sourceManga,
            langCode: "PT-BR",
            chapNum,
            title: text || `Capítulo ${chapNum}`,
            volume: 0,
          });
        }
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterUrl = chapter.chapterId.startsWith("http")
      ? chapter.chapterId
      : `${BASE_URL}${chapter.chapterId.startsWith("/") ? "" : "/"}${chapter.chapterId}`;

    const [_, buffer] = await Application.scheduleRequest({ url: chapterUrl, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    const addPage = (src: string | undefined) => {
      if (!src) return;
      let url = src.trim();
      if (!url.startsWith("http")) {
        url = BASE_URL + (url.startsWith("/") ? "" : "/") + url;
      }

      url = cleanThumbnail(url)
        .replace(/\/s\d+(-c)?\//g, "/s16000/")
        .replace(/\/s\d+-w\d+-c-h\d+\//g, "/s16000/")
        .replace(/=s\d+(-c)?$/g, "=s0");

      const lower = url.toLowerCase();
      if (
        lower.includes("error.png") ||
        lower.includes("avatar") ||
        lower.includes("logo") ||
        lower.includes("favicon") ||
        lower.includes("banner") ||
        lower.includes("icon") ||
        lower.includes("widget")
      ) {
        return;
      }

      if (!seenPages.has(url)) {
        seenPages.add(url);
        pages.push(url);
      }
    };

    $(".separator img, .post-body img, .entry-content img, #readerarea img").each((_, el) => {
      if ($(el).closest(".header-image-wrapper").length > 0) return;
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original");
      addPage(src);
    });

    const rawText = $("#zeist-raw-data").text().trim();
    if (rawText && pages.length === 0) {
      const $raw = cheerio.load(rawText);
      $raw(".separator img, img").each((_, el) => {
        addPage($raw(el).attr("src") || $raw(el).attr("data-src"));
      });
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
              containsMoreItems: sec.id !== "popular",
              type: "singleRowNormal",
            })
          : {
              id: sec.id,
              title: sec.title,
              containsMoreItems: sec.id !== "popular",
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
      type: DiscoverSectionType.simpleCarousel,
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

export const Ler999 = new Ler999Extension();
