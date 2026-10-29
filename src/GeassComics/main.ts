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

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  ContentTemplateSearchMetadata,
  GeassApiResponse,
  GeassChapterPagesDto,
  GeassWorkDto,
  GeassWorkListDto,
} from "./models";
import { MainInterceptor } from "./network";
import type GeassComicsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://geasscomics.xyz";
const API_URL = "https://api.geasscomics.xyz";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}/${url.replace(/^\//, "")}`;
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

export class GeassComicsExtension implements ExtensionImpl<typeof GeassComicsConfig> {
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
      metadata: { orderBy: "recent", type: "all", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Lançamentos Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Melhor Avaliados",
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
    const sortBy = section.id === "popular" ? "rating" : "recent";
    const url = `${API_URL}/api/works?page=${page}&limit=24&sortBy=${sortBy}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: GeassApiResponse<GeassWorkListDto> = JSON.parse(
        Application.arrayBufferToUTF8String(buffer),
      );
      const itemsList = json.data?.items ?? [];
      const items: DiscoverSectionItem[] = [];

      for (const item of itemsList) {
        const title = item.title?.trim() || "Sem título";
        const mangaId = item.slug;
        const imageUrl =
          cleanCoverUrl(item.coverLarge || item.cover) ||
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

      const hasNextPage = json.data ? json.data.page < json.data.pageCount : false;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção Geass Comics ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const sortBy = query.metadata?.orderBy || "recent";
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      sortBy,
    });

    if (query.title && query.title.trim().length > 0) {
      params.set("q", query.title.trim());
    }

    if (query.metadata?.type && query.metadata.type !== "all") {
      params.set("types", query.metadata.type);
    }

    if (query.metadata?.status && query.metadata.status !== "all") {
      params.set("status", query.metadata.status);
    }

    const url = `${API_URL}/api/works?${params.toString()}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: GeassApiResponse<GeassWorkListDto> = JSON.parse(
        Application.arrayBufferToUTF8String(buffer),
      );
      const itemsList = json.data?.items ?? [];
      const items: SearchResultItem[] = [];

      for (const item of itemsList) {
        const title = item.title?.trim() || "Sem título";
        const mangaId = item.slug;
        const imageUrl =
          cleanCoverUrl(item.coverLarge || item.cover) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = json.data ? json.data.page < json.data.pageCount : false;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca Geass Comics:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId.replace(/^\/manga\//, "").replace(/^\//, "");
    const url = `${API_URL}/api/works/${slug}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: GeassApiResponse<GeassWorkDto> = JSON.parse(
      Application.arrayBufferToUTF8String(buffer),
    );
    const work = json.data;

    const title = work.title?.trim() || slug;
    const thumbnailUrl =
      cleanCoverUrl(work.coverLarge || work.cover) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const synopsis = work.synopsis?.trim() || "";

    const rawStatus = (work.status || "").toLowerCase();
    let status = "ongoing";
    if (rawStatus === "completed") {
      status = "completed";
    } else if (rawStatus === "hiatus") {
      status = "hiatus";
    }

    const tagList: Tag[] = [];
    if (work.tags && Array.isArray(work.tags)) {
      for (const t of work.tags) {
        if (t) {
          tagList.push({ id: sanitizeTagId(t), title: t });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: work.author?.trim() || "Geass Comics",
        artist: work.author?.trim() || "Geass Comics",
        tagGroups: tagList.length > 0 ? [{ id: "genres", title: "Gêneros", tags: tagList }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: `${BASE_URL}/work/${slug}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId.replace(/^\/manga\//, "").replace(/^\//, "");
    const url = `${API_URL}/api/works/${slug}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: GeassApiResponse<GeassWorkDto> = JSON.parse(
      Application.arrayBufferToUTF8String(buffer),
    );
    const work = json.data;
    const chaptersList = work.chapters ?? [];
    const chapters: Chapter[] = [];

    for (const c of chaptersList) {
      const num = typeof c.number === "number" ? c.number : parseFloat(String(c.number)) || 0;
      const chapterIdentifier = `${slug}/${num}/${c.id}`;
      const title =
        c.title && !c.title.startsWith("Capítulo")
          ? `Capítulo ${num} - ${c.title}`
          : `Capítulo ${num}`;

      chapters.push({
        chapterId: chapterIdentifier,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num,
        title,
        volume: 0,
        publishDate: c.releasedAt ? new Date(c.releasedAt) : undefined,
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const parts = chapter.chapterId.split("/");
    const slug = parts[0] || chapter.sourceManga.mangaId;
    const number = parts[1] || String(chapter.chapNum);

    const url = `${API_URL}/api/works/${slug}/chapters/${number}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: GeassApiResponse<GeassChapterPagesDto> = JSON.parse(
      Application.arrayBufferToUTF8String(buffer),
    );
    const pagesList = json.data?.pages ?? [];

    const pages: string[] = [];
    for (const p of pagesList) {
      if (!p) continue;
      const pageUrl = p.startsWith("http") ? p : `${API_URL}/${p.replace(/^\//, "")}`;
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

export const GeassComics = new GeassComicsExtension();
