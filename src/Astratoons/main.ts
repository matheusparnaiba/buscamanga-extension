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
import type {
  AstraChapterListDto,
  AstraComicsResponseDto,
  ContentTemplateSearchMetadata,
} from "./models";
import { MainInterceptor } from "./network";
import type AstratoonsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://new.astratoons.com";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const path = url.replace(/^\/?(storage\/)?/, "");
  return `${BASE_URL}/storage/${path}`;
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

export class AstratoonsExtension implements ExtensionImpl<typeof AstratoonsConfig> {
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
      metadata: { orderBy: "updated_at", status: "all", type: "all" },
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
    let sortBy = "updated_at";
    if (section.id === "popular") {
      sortBy = "chapters_count";
    }

    const url = `${BASE_URL}/api/comics?sortBy=${sortBy}&page=${page}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: AstraComicsResponseDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const comics = json.data ?? [];
      const items: DiscoverSectionItem[] = [];

      for (const comic of comics) {
        const title = comic.title?.trim() || "Sem título";
        const mangaId = `${comic.slug}:${comic.id}`;
        const imageUrl =
          cleanCoverUrl(comic.cover_image) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: comic.type || "Atualizado",
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

      const hasNextPage = json.current_page < json.last_page;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção Astratoons ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const sortBy = query.metadata?.orderBy || "updated_at";
    const params = new URLSearchParams({
      page: String(page),
      sortBy,
    });

    if (query.title && query.title.trim().length > 0) {
      params.set("search", query.title.trim());
    }

    if (query.metadata?.status && query.metadata.status !== "all") {
      params.set("status", query.metadata.status);
    }

    if (query.metadata?.type && query.metadata.type !== "all") {
      params.set("types[]", query.metadata.type);
    }

    const url = `${BASE_URL}/api/comics?${params.toString()}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: AstraComicsResponseDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const comics = json.data ?? [];
      const items: SearchResultItem[] = [];

      for (const comic of comics) {
        const title = comic.title?.trim() || "Sem título";
        const mangaId = `${comic.slug}:${comic.id}`;
        const imageUrl =
          cleanCoverUrl(comic.cover_image) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = json.current_page < json.last_page;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca Astratoons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId.includes(":") ? mangaId.split(":")[0]! : mangaId;
    const url = `${BASE_URL}/comics/${slug}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title =
      $("h1").first().text().trim() || $('meta[property="og:title"]').attr("content") || slug;

    const rawCover =
      $('img[class*="object-cover"]').first().attr("src") ||
      $('meta[property="og:image"]').attr("content");
    const thumbnailUrl =
      cleanCoverUrl(rawCover) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const synopsis = (
      $("div.space-y-4 > p").first().text() ||
      $("div:has(>h1) + div").first().text() ||
      $('meta[name="description"]').attr("content") ||
      ""
    ).trim();

    const author = $("span:contains('Autor') > span").first().text().trim() || undefined;
    const artist = $("span:contains('Artista') > span").first().text().trim() || author;

    const statusText = (
      $("h3:contains('Informações') + div span.capitalize").first().text() || ""
    ).toLowerCase();

    let status = "ongoing";
    if (statusText.includes("completo") || statusText.includes("finalizado")) {
      status = "completed";
    } else if (statusText.includes("hiato")) {
      status = "hiatus";
    }

    const tagList: Tag[] = [];
    $("h3:contains('Tags') + div a, a[href*='/tags/']").each((_, el) => {
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
        status,
        author: author || "Astratoons",
        artist: artist || author || "Astratoons",
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
    let comicId = sourceManga.mangaId.includes(":")
      ? parseInt(sourceManga.mangaId.split(":")[1]!, 10)
      : 0;

    if (!comicId || isNaN(comicId)) {
      const mangaUrl = `${BASE_URL}/comics/${slug}`;
      const [_, buffer] = await Application.scheduleRequest({ url: mangaUrl, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const match = html.match(/comicId:\s*(\d+)/);
      if (match?.[1]) {
        comicId = parseInt(match[1], 10);
      }
    }

    if (!comicId || isNaN(comicId)) {
      return [];
    }

    const chapters: Chapter[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${BASE_URL}/api/comics/${comicId}/chapters?search=&order=desc&page=${page}`;
      try {
        const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
        const json: AstraChapterListDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        hasMore = json.hasMore ?? false;

        if (json.html) {
          const $ = cheerio.load(json.html);
          $("a").each((_, el) => {
            const href = $(el).attr("href")?.trim();
            if (!href) return;

            const name = $(el).find(".text-lg").first().text().trim() || $(el).text().trim();
            const numMatch = name.match(/(\d+(\.\d+)?)/);
            const chapNum = numMatch ? parseFloat(numMatch[1] as string) : 0;

            chapters.push({
              chapterId: href,
              sourceManga,
              langCode: "PT-BR",
              chapNum,
              title: name,
              volume: 0,
            });
          });
        }

        page++;
      } catch (e) {
        console.error(`Erro ao obter capítulos Astratoons comicId ${comicId} (pág ${page}):`, e);
        break;
      }
    }

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
        url = `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
      }
      if (!seenPages.has(url) && !url.includes("avatar") && !url.includes("logo")) {
        seenPages.add(url);
        pages.push(url);
      }
    };

    $("#reader-container img, #reader-container canvas").each((_, el) => {
      const src =
        $(el).attr("data-src") ||
        $(el).attr("src") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-original");
      addPage(src);
    });

    if (pages.length === 0) {
      $("div.ad-container, script, style").remove();
      $("canvas[data-src], img[data-src], img[src]").each((_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src");
        if (
          src &&
          (src.includes("/storage/chapters/") ||
            src.includes(".webp") ||
            src.includes(".jpg") ||
            src.includes(".png"))
        ) {
          addPage(src);
        }
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

export const Astratoons = new AstratoonsExtension();
