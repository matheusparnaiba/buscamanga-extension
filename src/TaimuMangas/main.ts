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
  TaimuChapterDetailResponse,
  TaimuChapterListResponse,
  TaimuLibraryResponse,
  TaimuSearchMetadata,
  TaimuSeriesDetail,
  TaimuUpdatesResponse,
} from "./models";
import { MainInterceptor } from "./network";
import type TaimuMangasConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://taimumangas.com";

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-zA-Z0-9._\-@()[\]%?#+=/&:]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}
const API_BASE_URL = "https://api.taimumangas.com/api/v1/reader";

export class TaimuMangasExtension implements ExtensionImpl<typeof TaimuMangasConfig> {
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
        title: "Últimas Atualizações",
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

    if (section.id === "popular") {
      const url = `${API_BASE_URL}/library?page=${page}&per_page=24&adult=true&sort=rating&order=desc`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const response: TaimuLibraryResponse = JSON.parse(data);

      const items: DiscoverSectionItem[] = (response.items ?? []).map((item) => ({
        mangaId: item.identifier,
        title: item.title,
        imageUrl:
          item.cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
        type: "prominentCarouselItem",
        contentRating: ContentRating.EVERYONE,
      }));

      const hasNext = page * response.per_page < response.total;

      return {
        items,
        metadata: hasNext ? page + 1 : undefined,
      };
    }

    if (section.id === "updates") {
      const url = `${API_BASE_URL}/updates?page=${page}&per_page=24&adult_mode=true`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const response: TaimuUpdatesResponse = JSON.parse(data);

      const items: DiscoverSectionItem[] = (response.items ?? []).map((item) => {
        const subtitle = item.chapter_number ? `Capítulo ${item.chapter_number}` : undefined;
        return {
          mangaId: item.series_identifier,
          chapterId: item.series_identifier,
          title: item.series_title,
          subtitle,
          imageUrl:
            item.series_cover ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.series_title)}&background=random`,
          type: "chapterUpdatesCarouselItem",
          contentRating: ContentRating.EVERYONE,
        };
      });

      return {
        items,
        metadata: response.has_more ? page + 1 : undefined,
      };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { sort: "rating", status: "all", type: "all", genre: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<TaimuSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const sort = query.metadata?.sort ?? "rating";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const type = query.metadata?.type && query.metadata.type !== "all" ? query.metadata.type : "";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";

    const urlParams: string[] = [
      `page=${page}`,
      "per_page=24",
      "adult=true",
      `sort=${encodeURIComponent(sort)}`,
      "order=desc",
    ];

    if (title) urlParams.push(`q=${encodeURIComponent(title)}`);
    if (status) urlParams.push(`status=${encodeURIComponent(status)}`);
    if (type) urlParams.push(`type=${encodeURIComponent(type)}`);
    if (genre) urlParams.push(`genres=${encodeURIComponent(genre)}`);

    const url = `${API_BASE_URL}/library?${urlParams.join("&")}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const response: TaimuLibraryResponse = JSON.parse(data);

    const items: SearchResultItem[] = (response.items ?? []).map((item) => ({
      mangaId: item.identifier,
      title: item.title,
      imageUrl:
        item.cover ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
      contentRating: ContentRating.EVERYONE,
    }));

    const hasNext = page * response.per_page < response.total;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_BASE_URL}/series/${mangaId}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const detail: TaimuSeriesDetail = JSON.parse(data);

    const title = detail.title || "Obra";
    const image = detail.cover || "";
    const thumbnailUrl =
      image || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    let status = "ongoing";
    const st = detail.status?.toLowerCase();
    if (st === "finished") status = "completed";
    else if (st === "hiatus") status = "hiatus";
    else if (st === "dropped") status = "cancelled";

    const authors = (detail.authors ?? []).map((a) => a.name).join(", ");
    const artists = (detail.artists ?? []).map((a) => a.name).join(", ");
    const author = authors || artists || "Desconhecido";

    const genres: Tag[] = (detail.genres ?? []).map((g) => ({
      id: sanitizeTagId(g.name),
      title: g.name,
    }));

    const shareUrl = `${BASE_URL}/series/${mangaId}`;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: detail.synopsis || "",
        contentRating: detail.adult ? ContentRating.MATURE : ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const url = `${API_BASE_URL}/series/${sourceManga.mangaId}/chapters?page=${page}&per_page=100&order=desc`;
      const request = { url, method: "GET" };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const response: TaimuChapterListResponse = JSON.parse(data);

      const items = response.items ?? [];
      for (const item of items) {
        const num =
          typeof item.number === "number" ? item.number : parseFloat(item.number as string) || 0;
        const publishDate = item.published_at ? new Date(item.published_at) : undefined;

        chapters.push({
          chapterId: item.identifier,
          sourceManga,
          langCode: "PT-BR",
          chapNum: num,
          title: `Capítulo ${item.number}`,
          volume: 0,
          publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
        });
      }

      hasMore = response.has_more === true;
      page++;
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${API_BASE_URL}/chapters/${chapter.chapterId}?adult=true`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const response: TaimuChapterDetailResponse = JSON.parse(data);

    const pages = (response.pages ?? []).map((p) => p.url).filter((u) => !!u);

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

export const TaimuMangas = new TaimuMangasExtension();
