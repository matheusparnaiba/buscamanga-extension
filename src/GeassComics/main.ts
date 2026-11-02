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
  GeassRecommendationsDto,
  GeassWorkDto,
  GeassWorkListDto,
  GeassWorkUpdateItemDto,
} from "./models";
import { MainInterceptor } from "./network";
import type GeassComicsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://geasscomics.xyz";
const API_URL = "https://api.geasscomics.xyz";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  let full = url;
  if (!full.startsWith("http://") && !full.startsWith("https://")) {
    full = `${API_URL}/${full.replace(/^\//, "")}`;
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
      metadata: { orderBy: "recent", genre: "all", type: "all", status: "all", tag: "all" },
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
        id: "highlights",
        title: "Destaques",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "top10",
        title: "Top 10 Mais Lidos",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genre-hentai",
        title: "Hentai (+18)",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genre-livre",
        title: "Livre",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genre-shoujo-romance",
        title: "Shoujo & Romance",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genre-yaoi",
        title: "Yaoi (+18)",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genre-nacional",
        title: "Nacionais",
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
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    try {
      if (section.id === "updates") {
        const limit = 24;
        const offset = (page - 1) * limit;
        const url = `${API_URL}/api/work-updates?offset=${offset}&limit=${limit}`;

        const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
        const json: GeassApiResponse<GeassWorkUpdateItemDto[]> = JSON.parse(
          Application.arrayBufferToUTF8String(buffer),
        );
        const updatesList = Array.isArray(json.data) ? json.data : [];
        const items: DiscoverSectionItem[] = [];

        for (const item of updatesList) {
          const work = item.work;
          if (!work) continue;
          const title = work.title?.trim() || "Sem título";
          const mangaId = work.slug;
          const imageUrl =
            cleanCoverUrl(work.coverLarge || work.cover) ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

          const firstChap = item.chapters?.[0];
          const subtitle =
            firstChap?.number !== undefined
              ? `Capítulo ${firstChap.number}`
              : work.status || "Atualizado";

          const isAdult = Boolean(
            work.isNsfw || work.genres?.includes("hentai") || work.genres?.includes("yaoi"),
          );

          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle,
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
          });
        }

        const hasNextPage = updatesList.length >= limit;
        return {
          items,
          metadata: hasNextPage ? page + 1 : undefined,
        };
      }

      if (section.id === "highlights") {
        const url = `${API_URL}/api/recommendations`;
        const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
        const json: GeassApiResponse<GeassRecommendationsDto> = JSON.parse(
          Application.arrayBufferToUTF8String(buffer),
        );
        let itemsList = json.data?.items ?? [];

        if (itemsList.length === 0) {
          const [__, fallbackBuf] = await Application.scheduleRequest({
            url: `${API_URL}/api/works?page=1&limit=10&sortBy=popular`,
            method: "GET",
          });
          const fallbackJson: GeassApiResponse<GeassWorkListDto> = JSON.parse(
            Application.arrayBufferToUTF8String(fallbackBuf),
          );
          itemsList = fallbackJson.data?.items ?? [];
        }

        const items: DiscoverSectionItem[] = itemsList.map((item) => {
          const title = item.title?.trim() || "Sem título";
          const mangaId = item.slug;
          const imageUrl =
            cleanCoverUrl(item.coverLarge || item.cover) ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

          const isAdult = Boolean(
            item.isNsfw || item.genres?.includes("hentai") || item.genres?.includes("yaoi"),
          );

          return {
            mangaId,
            title,
            imageUrl,
            type: "prominentCarouselItem",
            contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
          };
        });

        return { items, metadata: undefined };
      }

      if (section.id === "top10") {
        const url = `${API_URL}/api/works?page=1&limit=10&sortBy=popular`;
        const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
        const json: GeassApiResponse<GeassWorkListDto> = JSON.parse(
          Application.arrayBufferToUTF8String(buffer),
        );
        const itemsList = json.data?.items ?? [];

        const items: DiscoverSectionItem[] = itemsList.map((item) => {
          const title = item.title?.trim() || "Sem título";
          const mangaId = item.slug;
          const imageUrl =
            cleanCoverUrl(item.coverLarge || item.cover) ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

          const isAdult = Boolean(
            item.isNsfw || item.genres?.includes("hentai") || item.genres?.includes("yaoi"),
          );

          return {
            mangaId,
            title,
            imageUrl,
            type: "simpleCarouselItem",
            contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
          };
        });

        return { items, metadata: undefined };
      }

      let fetchUrl = `${API_URL}/api/works?page=${page}&limit=24`;
      if (section.id.startsWith("genre-")) {
        const genre = section.id.replace("genre-", "");
        fetchUrl += `&genres=${encodeURIComponent(genre)}&sortBy=popular`;
      } else {
        fetchUrl += `&sortBy=popular`;
      }

      const [_, buffer] = await Application.scheduleRequest({ url: fetchUrl, method: "GET" });
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

        const isAdult = Boolean(
          item.isNsfw || item.genres?.includes("hentai") || item.genres?.includes("yaoi"),
        );

        items.push({
          mangaId,
          title,
          imageUrl,
          type: "simpleCarouselItem",
          contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
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

    if (query.metadata?.genre && query.metadata.genre !== "all") {
      params.set("genres", query.metadata.genre);
    }

    if (query.metadata?.status && query.metadata.status !== "all") {
      params.set("status", query.metadata.status);
    }

    if (query.metadata?.tag && query.metadata.tag !== "all") {
      params.set("tags", query.metadata.tag);
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

        const isAdult = Boolean(
          item.isNsfw || item.genres?.includes("hentai") || item.genres?.includes("yaoi"),
        );

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
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
    if (work.genres && Array.isArray(work.genres)) {
      for (const g of work.genres) {
        if (g) {
          tagList.push({ id: sanitizeTagId(g), title: `Gênero: ${g.toUpperCase()}` });
        }
      }
    }
    if (work.tags && Array.isArray(work.tags)) {
      for (const t of work.tags) {
        if (t) {
          tagList.push({ id: sanitizeTagId(t), title: t });
        }
      }
    }

    const isAdult = Boolean(
      work.isNsfw ||
      work.genres?.includes("hentai") ||
      work.genres?.includes("yaoi") ||
      work.tags?.some(
        (t) =>
          t.toLowerCase().includes("adulto") ||
          t.toLowerCase().includes("hentai") ||
          t.toLowerCase().includes("gore"),
      ),
    );

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        status,
        author: work.author?.trim() || "Geass Comics",
        artist: work.author?.trim() || "Geass Comics",
        tagGroups:
          tagList.length > 0 ? [{ id: "genres", title: "Tags e Gêneros", tags: tagList }] : [],
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
      const numStr = String(c.number);
      const chapterIdentifier = `${slug}/${numStr}/${c.id}`;
      const title =
        c.title && !c.title.startsWith("Capítulo")
          ? `Capítulo ${numStr} - ${c.title}`
          : `Capítulo ${numStr}`;

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
      let pageUrl = p.startsWith("http") ? p : `${API_URL}/${p.replace(/^\//, "")}`;
      try {
        pageUrl = decodeURI(pageUrl);
      } catch {}
      pages.push(encodeURI(pageUrl).replace(/%2520/g, "%20").replace(/ /g, "%20"));
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

export const GeassComics = new GeassComicsExtension();
