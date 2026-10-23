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
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

const GRAPHQL_URL = "https://admin.hq-now.com/graphql";
const SITE_URL = "https://www.hq-now.com";

function cleanJson(body: string): any {
  const cleaned = body
    .replace(/^[\uFEFF\s]+/, "")
    .replace(/^\)]}'/, "")
    .replace(/^[,_]/, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalizeImageUrl(url: string | null | undefined, title: string): string {
  if (!url) {
    return "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
  }
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  if (url.startsWith("//")) {
    return "https:" + url;
  }
  return url;
}

export class HQNowExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "popular",
        title: "Mais Lidos (Popular)",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if (section.id === "popular") {
      if (page > 1) return { items: [], metadata: undefined };

      const body = JSON.stringify({
        query: `query getHqsByFilters($orderByViews: Boolean, $limit: Int, $loadCovers: Boolean) {
          getHqsByFilters(orderByViews: $orderByViews, limit: $limit, loadCovers: $loadCovers) {
            id
            name
            hqCover
            synopsis
          }
        }`,
        variables: {
          orderByViews: true,
          limit: 100,
          loadCovers: true,
        },
        operationName: "getHqsByFilters",
      });

      const request = {
        url: GRAPHQL_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const json = cleanJson(data);
      const items: DiscoverSectionItem[] = [];

      for (const hq of json.data?.getHqsByFilters || []) {
        const mangaId = String(hq.id);
        const title = hq.name || mangaId;
        const imageUrl = normalizeImageUrl(hq.hqCover, title);

        items.push({
          mangaId,
          title,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }

      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      if (page > 1) return { items: [], metadata: undefined };

      const body = JSON.stringify({
        query: `query getRecentlyUpdatedHqs {
          getRecentlyUpdatedHqs {
            id
            name
            hqCover
            synopsis
            updatedAt
          }
        }`,
        operationName: "getRecentlyUpdatedHqs",
      });

      const request = {
        url: GRAPHQL_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const json = cleanJson(data);
      const items: DiscoverSectionItem[] = [];

      for (const hq of json.data?.getRecentlyUpdatedHqs || []) {
        const mangaId = String(hq.id);
        const title = hq.name || mangaId;
        const imageUrl = normalizeImageUrl(hq.hqCover, title);

        items.push({
          mangaId,
          chapterId: mangaId,
          title,
          imageUrl,
          type: "chapterUpdatesCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }

      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "popular" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    if (page > 1) return { items: [], metadata: undefined };

    let body: string;

    if (query.title && query.title.trim()) {
      body = JSON.stringify({
        query: `query getHqsByName($name: String!) {
          getHqsByName(name: $name) {
            id
            name
            hqCover
            synopsis
          }
        }`,
        variables: {
          name: query.title.trim(),
        },
        operationName: "getHqsByName",
      });
    } else if (query.metadata?.orderBy === "updates") {
      body = JSON.stringify({
        query: `query getRecentlyUpdatedHqs {
          getRecentlyUpdatedHqs {
            id
            name
            hqCover
            synopsis
            updatedAt
          }
        }`,
        operationName: "getRecentlyUpdatedHqs",
      });
    } else {
      body = JSON.stringify({
        query: `query getHqsByFilters($orderByViews: Boolean, $limit: Int, $loadCovers: Boolean) {
          getHqsByFilters(orderByViews: $orderByViews, limit: $limit, loadCovers: $loadCovers) {
            id
            name
            hqCover
            synopsis
          }
        }`,
        variables: {
          orderByViews: true,
          limit: 100,
          loadCovers: true,
        },
        operationName: "getHqsByFilters",
      });
    }

    const request = {
      url: GRAPHQL_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const items: SearchResultItem[] = [];

    const list =
      json.data?.getHqsByName ||
      json.data?.getRecentlyUpdatedHqs ||
      json.data?.getHqsByFilters ||
      [];
    for (const hq of list) {
      const mangaId = String(hq.id);
      const title = hq.name || mangaId;
      const imageUrl = normalizeImageUrl(hq.hqCover, title);

      items.push({
        mangaId,
        title,
        imageUrl,
        contentRating: ContentRating.EVERYONE,
      });
    }

    return {
      items,
      metadata: undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const id = parseInt(mangaId, 10);
    const body = JSON.stringify({
      query: `query getHqsById($id: Int!) {
        getHqsById(id: $id) {
          id
          name
          synopsis
          publisherName
          status
          hqCover
        }
      }`,
      variables: { id },
      operationName: "getHqsById",
    });

    const request = {
      url: GRAPHQL_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const hq = json.data?.getHqsById?.[0] || {};

    const title = hq.name || mangaId;
    const imageUrl = normalizeImageUrl(hq.hqCover, title);
    const synopsis = hq.synopsis || "";
    const author = hq.publisherName || "Desconhecido";

    let status = "ONGOING";
    if (hq.status === "Concluído") {
      status = "COMPLETED";
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: imageUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: hq.publisherName
          ? [
              {
                id: "publisher",
                title: "Editora",
                tags: [
                  {
                    id: hq.publisherName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                    title: hq.publisherName,
                  },
                ],
              },
            ]
          : [],
        artworkUrls: [imageUrl],
        shareUrl: `${SITE_URL}/hq/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const id = parseInt(sourceManga.mangaId, 10);
    const body = JSON.stringify({
      query: `query getHqsById($id: Int!) {
        getHqsById(id: $id) {
          id
          name
          capitulos {
            name
            id
            number
          }
        }
      }`,
      variables: { id },
      operationName: "getHqsById",
    });

    const request = {
      url: GRAPHQL_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const chapters: Chapter[] = [];

    const hq = json.data?.getHqsById?.[0];
    const rawChapters = hq?.capitulos || [];

    for (const c of rawChapters) {
      const chapId = String(c.id);
      const numStr = String(c.number || "0");
      const num = parseFloat(numStr) || 0;
      const title = c.name ? `#${numStr} - ${c.name}` : `Edição #${numStr}`;

      chapters.push({
        chapterId: chapId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num,
        title,
        volume: 0,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = parseInt(chapter.chapterId, 10);
    const body = JSON.stringify({
      query: `query getChapterById($chapterId: Int!) {
        getChapterById(chapterId: $chapterId) {
          pictures {
            pictureUrl
          }
        }
      }`,
      variables: { chapterId },
      operationName: "getChapterById",
    });

    const request = {
      url: GRAPHQL_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);

    const pages: string[] = [];
    for (const pic of json.data?.getChapterById?.pictures || []) {
      if (pic.pictureUrl) {
        const picUrl = pic.pictureUrl.startsWith("http://")
          ? pic.pictureUrl.replace("http://", "https://")
          : pic.pictureUrl;
        pages.push(picUrl);
      }
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

export const HQNow = new HQNowExtension();
