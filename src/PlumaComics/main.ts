/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  CloudflareError,
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
import type {
  ContentTemplateSearchMetadata,
  PlumaChapterDto,
  PlumaObrasResponseDto,
  PlumaSeriesItemDto,
  PlumaViewerResponseDto,
} from "./models";
import { MainInterceptor } from "./network";
import type PlumaComicsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://plumacomics.cloud";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  let full = url;
  if (!full.startsWith("http://") && !full.startsWith("https://")) {
    const path = full.replace(/^\/?(api\/cover\/)?/, "");
    full = `${BASE_URL}/api/cover/${path}`;
  }
  try {
    full = decodeURI(full);
  } catch {}
  return encodeURI(full).replace(/%2520/g, "%20").replace(/ /g, "%20");
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

export class PlumaComicsExtension implements ExtensionImpl<typeof PlumaComicsConfig> {
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
      metadata: { orderBy: "popular", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Recém Atualizados",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
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
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const sort = section.id === "popular" ? "popular" : "recent";
    const url = `${BASE_URL}/api/obras?page=${page}&sort=${sort}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: PlumaObrasResponseDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const seriesList: PlumaSeriesItemDto[] = json.series ?? [];
      const items: DiscoverSectionItem[] = [];

      for (const item of seriesList) {
        const title = item.title?.trim() || "Sem título";
        const mangaId = `${item.slug}:${item.id}`;
        const imageUrl =
          cleanCoverUrl(item.coverPath) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: item.status || "Atualizado",
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else if (section.id === "popular") {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      const totalPages = json.totalPages ?? 1;
      const hasNextPage = page < totalPages;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error(`Erro ao carregar seção Pluma Comics ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const sort = query.metadata?.orderBy || "popular";
    const params = new URLSearchParams({
      page: String(page),
      sort,
    });

    if (query.title && query.title.trim().length > 0) {
      params.set("q", query.title.trim());
    }

    if (query.metadata?.status && query.metadata.status !== "all") {
      params.set("status", query.metadata.status);
    }

    const url = `${BASE_URL}/api/obras?${params.toString()}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: PlumaObrasResponseDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const seriesList: PlumaSeriesItemDto[] = json.series ?? [];
      const items: SearchResultItem[] = [];

      for (const item of seriesList) {
        const title = item.title?.trim() || "Sem título";
        const mangaId = `${item.slug}:${item.id}`;
        const imageUrl =
          cleanCoverUrl(item.coverPath) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const totalPages = json.totalPages ?? 1;
      const hasNextPage = page < totalPages;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("Erro na busca Pluma Comics:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId.includes(":") ? mangaId.split(":")[0]! : mangaId;
    let url = `${BASE_URL}/title/${slug}`;

    let html = "";
    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      html = Application.arrayBufferToUTF8String(buffer);
    } catch {
      url = `${BASE_URL}/obra/${slug}`;
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      html = Application.arrayBufferToUTF8String(buffer);
    }

    const $ = cheerio.load(html);

    let title =
      $('meta[property*="title"]').attr("content")?.split("|")[0]?.trim() ||
      $("h1").first().text().trim() ||
      slug;

    const rawCover =
      $("img.object-cover").first().attr("src") || $('meta[property="og:image"]').attr("content");
    const thumbnailUrl =
      cleanCoverUrl(rawCover) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const synopsis = (
      $("div p.text-neutral-300.text-sm").first().text() ||
      $('meta[name="description"]').attr("content") ||
      ""
    ).trim();

    const tagList: Tag[] = [];
    $("a[href*='?genre='], a[href*='/genero/']").each((_, el) => {
      const g = $(el).text().trim();
      if (g) {
        tagList.push({ id: sanitizeTagId(g), title: g });
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
        author: "Pluma Comics",
        artist: "Pluma Comics",
        tagGroups: tagList.length > 0 ? [{ id: "genres", title: "Gêneros", tags: tagList }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId.includes(":")
      ? sourceManga.mangaId.split(":")[0]!
      : sourceManga.mangaId;

    let url = `${BASE_URL}/title/${slug}`;
    let html = "";
    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      html = Application.arrayBufferToUTF8String(buffer);
    } catch {
      url = `${BASE_URL}/obra/${slug}`;
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      html = Application.arrayBufferToUTF8String(buffer);
    }

    const chapters: Chapter[] = [];
    const $ = cheerio.load(html);

    // Check for Next.js __NEXT_DATA__
    const nextDataText = $("#__NEXT_DATA__").html();
    if (nextDataText) {
      try {
        const nextJson = JSON.parse(nextDataText);
        const pageProps = nextJson?.props?.pageProps;
        const chapList: PlumaChapterDto[] =
          pageProps?.chapters || pageProps?.series?.chapters || [];
        for (const chap of chapList) {
          const chapNum =
            typeof chap.number === "number" ? chap.number : parseFloat(String(chap.number)) || 0;
          const name = chap.title
            ? `${chap.isVipOnly ? "🔒 " : ""}${chap.title}`
            : `${chap.isVipOnly ? "🔒 " : ""}Capítulo ${chapNum}`;
          chapters.push({
            chapterId: String(chap.id),
            sourceManga,
            langCode: "PT-BR",
            chapNum,
            title: name,
            volume: 0,
            publishDate: chap.publishedAt ? new Date(chap.publishedAt) : undefined,
          });
        }
      } catch {
        // Continue fallback
      }
    }

    if (chapters.length === 0) {
      // Search for embedded chapters json in any script tag
      $("script").each((_, el) => {
        const text = $(el).html() || "";
        if (text.includes('"chapters":[') || text.includes('"chapterList":[')) {
          const match = text.match(/"chapters":\s*(\[\s*\{.*?\}\s*\])/);
          if (match?.[1]) {
            try {
              const list: PlumaChapterDto[] = JSON.parse(match[1]);
              for (const chap of list) {
                const chapNum =
                  typeof chap.number === "number"
                    ? chap.number
                    : parseFloat(String(chap.number)) || 0;
                const name = chap.title
                  ? `${chap.isVipOnly ? "🔒 " : ""}${chap.title}`
                  : `${chap.isVipOnly ? "🔒 " : ""}Capítulo ${chapNum}`;
                chapters.push({
                  chapterId: String(chap.id),
                  sourceManga,
                  langCode: "PT-BR",
                  chapNum,
                  title: name,
                  volume: 0,
                  publishDate: chap.publishedAt ? new Date(chap.publishedAt) : undefined,
                });
              }
            } catch {
              // Ignore
            }
          }
        }
      });
    }

    if (chapters.length === 0) {
      // HTML fallback
      $("a[href*='/read/'], a[href*='/ler/'], a[href*='/capitulo/']").each((_, el) => {
        const href = $(el).attr("href")?.trim();
        if (!href) return;
        const text = $(el).text().trim();
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
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId.replace(/[^0-9]/g, "") || chapter.chapterId;
    const url = `${BASE_URL}/api/viewer/bootstrap?c=${chapterId}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: PlumaViewerResponseDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const pageList = json.pages ?? [];

    const pages: string[] = [];
    for (const p of pageList) {
      if (!p.u) continue;
      const cleanUrl = p.u.trim();
      const pageUrl = cleanUrl.startsWith("http")
        ? cleanUrl
        : `${BASE_URL}/${cleanUrl.replace(/^\//, "")}`;
      pages.push(pageUrl);
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

export const PlumaComics = new PlumaComicsExtension();
