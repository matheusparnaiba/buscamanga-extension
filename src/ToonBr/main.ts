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
  ToonBrChapterDto,
  ToonBrMangaDto,
  ToonBrMangaListResponse,
  ToonBrSearchMetadata,
} from "./models";
import { MainInterceptor } from "./network";
import type ToonBrConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://toonbr.com";
const API_URL = "https://api.toonbr.com";
const CDN_URL = "https://cdn2.toonbr.com";

function getCoverUrl(coverPath: string | null | undefined): string {
  if (!coverPath) return "";
  if (coverPath.startsWith("http")) return coverPath;
  return `${CDN_URL}${coverPath.startsWith("/") ? "" : "/"}${coverPath}`;
}

export class ToonBrExtension implements ExtensionImpl<typeof ToonBrConfig> {
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
        id: "updates",
        title: "Últimos Lançamentos",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const pageSize = 24;

    const endpoint =
      section.id === "popular" ? "/api/manga/popular?limit=150" : "/api/manga/latest?limit=150";
    const request = { url: `${API_URL}${endpoint}`, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const list: ToonBrMangaDto[] = JSON.parse(data);

    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    const items: DiscoverSectionItem[] = slice.map((item) => {
      const cover = getCoverUrl(item.coverImage);
      const imageUrl =
        cover ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`;

      if (section.id === "popular") {
        return {
          mangaId: item.slug,
          title: item.title,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        };
      }

      const subtitle =
        item.latestChapter?.title ||
        (item.latestChapter?.chapterNumber != null
          ? `Capítulo ${item.latestChapter.chapterNumber}`
          : undefined);

      return {
        mangaId: item.slug,
        chapterId: item.latestChapter?.id || item.slug,
        title: item.title,
        subtitle,
        imageUrl,
        type: "chapterUpdatesCarouselItem",
        contentRating: ContentRating.EVERYONE,
      };
    });

    const hasNext = start + pageSize < list.length;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { categoryId: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<ToonBrSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const pageSize = 24;
    const title = query.title?.trim() ?? "";
    const categoryId =
      query.metadata?.categoryId && query.metadata.categoryId !== "all"
        ? query.metadata.categoryId
        : "";

    const urlParams: string[] = [`page=${page}`, `limit=${pageSize}`];
    if (title) urlParams.push(`search=${encodeURIComponent(title)}`);
    if (categoryId) urlParams.push(`categoryId=${encodeURIComponent(categoryId)}`);

    const url = `${API_URL}/api/manga?${urlParams.join("&")}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const result: ToonBrMangaListResponse = JSON.parse(data);

    const mangaList = result.data ?? [];
    const items: SearchResultItem[] = mangaList.map((item) => {
      const cover = getCoverUrl(item.coverImage);
      return {
        mangaId: item.slug,
        title: item.title,
        imageUrl:
          cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
        contentRating: ContentRating.EVERYONE,
      };
    });

    const hasNext = mangaList.length >= pageSize;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_URL}/api/manga/${mangaId}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const dto: ToonBrMangaDto = JSON.parse(data);

    const title = dto.title || "Obra";
    const image = getCoverUrl(dto.coverImage);
    const thumbnailUrl =
      image || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const status = dto.status === "ONGOING" ? "ongoing" : "completed";
    const author = dto.author || dto.artist || "Desconhecido";

    const genres: Tag[] = (dto.categories ?? []).map((c) => ({
      id: c.id,
      title: c.name,
    }));

    const shareUrl = `${BASE_URL}/manga/${dto.slug || mangaId}`;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: dto.description || "",
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Categorias", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const url = `${API_URL}/api/manga/${sourceManga.mangaId}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const dto: ToonBrMangaDto = JSON.parse(data);

    const chapters: Chapter[] = [];
    const chapterList: ToonBrChapterDto[] = dto.chapters ?? [];

    for (const c of chapterList) {
      const num = c.chapterNumber ?? 0;
      const title = c.title || `Capítulo ${num}`;
      const publishDate = c.createdAt ? new Date(c.createdAt) : undefined;

      chapters.push({
        chapterId: `/chapter/${c.id}`,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num,
        title,
        volume: 0,
        publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
      });
    }

    return chapters.sort((a, b) => b.chapNum - a.chapNum);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const cleanId = chapter.chapterId.replace(/^\/chapter\//, "").replace(/\/.*$/, "");
    const url = `${API_URL}/api/chapter/${cleanId}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const dto: ToonBrChapterDto = JSON.parse(data);

    const pages: string[] = (dto.pages ?? [])
      .map((p) => {
        if (!p.imageUrl) return "";
        if (p.imageUrl.startsWith("http")) return p.imageUrl;
        return `${CDN_URL}${p.imageUrl.startsWith("/") ? "" : "/"}${p.imageUrl}`;
      })
      .filter((u) => !!u);

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

export const ToonBr = new ToonBrExtension();
