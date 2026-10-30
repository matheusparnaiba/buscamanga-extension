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
} from "@paperback/types";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  BRScansChapterPagesDto,
  BRScansManhwaDto,
  BRScansManhwaPageDto,
  BRScansSearchMetadata,
} from "./models";
import { MainInterceptor } from "./network";
import type BRScansConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://brscans.com";
const API_URL = "https://e5oer7ngt8.execute-api.sa-east-1.amazonaws.com/dev";

function getImageUrl(
  images:
    | { original?: string | null; translated?: string | null; raw?: string | null }
    | null
    | undefined,
): string {
  if (!images) return "";
  const src = images.original || images.translated || images.raw || "";
  try {
    return encodeURI(decodeURI(src));
  } catch {
    return src.replace(/\s+/g, "%20");
  }
}

export class BRScansExtension implements ExtensionImpl<typeof BRScansConfig> {
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

    try {
      if (section.id === "popular") {
        const url = `${API_URL}/manhwas/top/`;
        const request = { url, method: "GET" };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = Application.arrayBufferToUTF8String(buffer);
        const list: BRScansManhwaDto[] = JSON.parse(data);

        const items: DiscoverSectionItem[] = list.map((item) => {
          const cover = getImageUrl(item.thumbnail);
          return {
            mangaId: String(item.id),
            title: item.title,
            imageUrl:
              cover ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          };
        });

        return { items, metadata: undefined };
      }

      if (section.id === "updates") {
        const url = `${API_URL}/manhwas/?page=${page}`;
        const request = { url, method: "GET" };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = Application.arrayBufferToUTF8String(buffer);
        const pageDto: BRScansManhwaPageDto = JSON.parse(data);

        const items: DiscoverSectionItem[] = (pageDto.results ?? []).map((item) => {
          const cover = getImageUrl(item.thumbnail);
          return {
            mangaId: String(item.id),
            chapterId: String(item.id),
            title: item.title,
            imageUrl:
              cover ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          };
        });

        return {
          items,
          metadata: pageDto.next ? page + 1 : undefined,
        };
      }
    } catch (e) {
      console.error(`Erro ao buscar itens de ${section.id} em BRScans:`, e);
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { order: "latest", variant: "translated" },
    });
  }

  async getSearchResults(
    query: SearchQuery<BRScansSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";

    try {
      if (title) {
        const url = `${API_URL}/manhwas/search/?query=${encodeURIComponent(title)}`;
        const request = { url, method: "GET" };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = Application.arrayBufferToUTF8String(buffer);
        const list: BRScansManhwaDto[] = JSON.parse(data);

        const items: SearchResultItem[] = list.map((item) => {
          const cover = getImageUrl(item.thumbnail);
          return {
            mangaId: String(item.id),
            title: item.title,
            imageUrl:
              cover ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
            contentRating: ContentRating.EVERYONE,
          };
        });

        return { items, metadata: undefined };
      }

      if (query.metadata?.order === "top") {
        const url = `${API_URL}/manhwas/top/`;
        const request = { url, method: "GET" };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = Application.arrayBufferToUTF8String(buffer);
        const list: BRScansManhwaDto[] = JSON.parse(data);

        const items: SearchResultItem[] = list.map((item) => {
          const cover = getImageUrl(item.thumbnail);
          return {
            mangaId: String(item.id),
            title: item.title,
            imageUrl:
              cover ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
            contentRating: ContentRating.EVERYONE,
          };
        });

        return { items, metadata: undefined };
      }

      const url = `${API_URL}/manhwas/?page=${page}`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const pageDto: BRScansManhwaPageDto = JSON.parse(data);

      const items: SearchResultItem[] = (pageDto.results ?? []).map((item) => {
        const cover = getImageUrl(item.thumbnail);
        return {
          mangaId: String(item.id),
          title: item.title,
          imageUrl:
            cover ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
          contentRating: ContentRating.EVERYONE,
        };
      });

      return {
        items,
        metadata: pageDto.next ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca de BRScans:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const cleanId = mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/manhwas/${cleanId}/`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const dto: BRScansManhwaDto = JSON.parse(data);

    const title = dto.title || "Obra";
    const image = getImageUrl(dto.thumbnail);
    const thumbnailUrl =
      image || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    let synopsis = dto.description || "";
    if (dto.original_title && dto.original_title.toLowerCase() !== dto.title.toLowerCase()) {
      synopsis = synopsis
        ? `${synopsis}\n\nTítulo original: ${dto.original_title}`
        : `Título original: ${dto.original_title}`;
    }

    const shareUrl = `${BASE_URL}/manga/${cleanId}`;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: dto.original_title ? [dto.original_title] : [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "ongoing",
        author: "Desconhecido",
        tagGroups: [],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const cleanId = sourceManga.mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/manhwas/${cleanId}/`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const dto: BRScansManhwaDto = JSON.parse(data);

    const chapters: Chapter[] = [];
    const chapterList = dto.chapters ?? [];

    for (const c of chapterList) {
      const numMatch = c.title.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;
      const publishDate = c.created_at ? new Date(c.created_at) : undefined;

      chapters.push({
        chapterId: `/manga/${cleanId}/chapter/${c.id}?variant=translated`,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title: c.title,
        volume: 0,
        publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
      });
    }

    return chapters.sort((a, b) => b.chapNum - a.chapNum);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapIdMatch = chapter.chapterId.match(/chapter\/(\d+)/);
    const cleanId = chapIdMatch ? chapIdMatch[1] : chapter.chapterId.replace(/[^0-9]/g, "");
    const variantMatch = chapter.chapterId.match(/variant=([a-z]+)/);
    const variant = variantMatch ? variantMatch[1] : "translated";

    const url = `${API_URL}/chapters/${cleanId}/`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const pageDto: BRScansChapterPagesDto = JSON.parse(data);

    const pages: string[] = [];
    for (const p of pageDto.pages ?? []) {
      let imgUrl: string | null | undefined;
      if (variant === "raw") imgUrl = p.images.raw || p.images.original;
      else if (variant === "original") imgUrl = p.images.original;
      else imgUrl = p.images.translated || p.images.original;

      if (imgUrl) pages.push(imgUrl);
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

export const BRScans = new BRScansExtension();
