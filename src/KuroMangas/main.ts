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
import type { KuroMangasSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type KuroMangasConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://kuromangas.com";

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
const API_URL = "https://kuromangas.com/api";
const CDN_URL = "https://cdn.kuromangas.com";

function buildImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  const cleanPath = path.replace(/^\/?uploads\//, "").replace(/^\//, "");
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${CDN_URL}/${cleanPath}`;
}

export class KuroMangasExtension implements ExtensionImpl<typeof KuroMangasConfig> {
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
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const items: DiscoverSectionItem[] = [];

    try {
      if (section.id === "popular") {
        const url = `${API_URL}/mangas?page=${page}&limit=24&sort=view_count&order=DESC`;
        const request = {
          url,
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: `${BASE_URL}/catalogo`,
          },
        };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        const list = Array.isArray(data.data) ? data.data : [];

        for (const m of list) {
          const mangaId = String(m.id ?? m.slug ?? "");
          if (!mangaId) continue;
          const title = m.title ?? mangaId;
          const img = buildImageUrl(m.cover_image);

          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }

        const hasNext = data.pagination?.hasNext ?? page < (data.pagination?.totalPages ?? 1);
        return {
          items,
          metadata: hasNext ? page + 1 : undefined,
        };
      } else {
        const url = `${API_URL}/chapters/recent?page=${page}&limit=24&days=30`;
        const request = {
          url,
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: `${BASE_URL}/catalogo`,
          },
        };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        const list = Array.isArray(data.data) ? data.data : [];

        for (const item of list) {
          const m = item.manga ?? item;
          const mangaId = String(m.id ?? m.manga_id ?? "");
          if (!mangaId) continue;
          const title = m.title ?? mangaId;
          const img = buildImageUrl(m.cover_image);
          const chapTitle = item.chapter_number ? `Capítulo ${item.chapter_number}` : undefined;

          items.push({
            mangaId,
            chapterId: String(item.id ?? mangaId),
            title,
            subtitle: chapTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }

        const hasNext = data.pagination?.hasNext ?? page < (data.pagination?.totalPages ?? 1);
        return {
          items,
          metadata: hasNext ? page + 1 : undefined,
        };
      }
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.title}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { sort: "view_count" },
    });
  }

  async getSearchResults(
    query: SearchQuery<KuroMangasSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const sortVal = query.metadata?.sort ?? "view_count";

    let sort = "view_count";
    let order = "DESC";

    if (sortVal === "average_rating") {
      sort = "average_rating";
      order = "DESC";
    } else if (sortVal === "created_at") {
      sort = "created_at";
      order = "DESC";
    } else if (sortVal === "title_asc") {
      sort = "title";
      order = "ASC";
    } else if (sortVal === "title_desc") {
      sort = "title";
      order = "DESC";
    }

    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", "24");
    params.append("sort", sort);
    params.append("order", order);
    if (title) params.append("search", title);

    const url = `${API_URL}/mangas?${params.toString()}`;
    const request = {
      url,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: `${BASE_URL}/catalogo`,
      },
    };

    const items: SearchResultItem[] = [];

    try {
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data.data) ? data.data : [];

      for (const m of list) {
        const mangaId = String(m.id ?? m.slug ?? "");
        if (!mangaId) continue;
        const mangaTitle = m.title ?? mangaId;
        const img = buildImageUrl(m.cover_image);

        items.push({
          mangaId,
          title: mangaTitle,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(mangaTitle) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNext = data.pagination?.hasNext ?? page < (data.pagination?.totalPages ?? 1);
      return {
        items,
        metadata: hasNext ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao buscar no KuroMangas:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_URL}/mangas/${mangaId}`;
    const request = {
      url,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: `${BASE_URL}/catalogo`,
      },
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const m = data.manga ?? data.data ?? data;

    const title = m.title ?? mangaId;
    const image = buildImageUrl(m.cover_image);
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const synopsis = m.description ?? "";

    const genres: Tag[] = [];
    if (Array.isArray(m.genres)) {
      for (const g of m.genres) {
        const gName = typeof g === "string" ? g : g.name;
        if (gName) {
          genres.push({
            id: sanitizeTagId(gName),
            title: gName,
          });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: Array.isArray(m.alternative_titles) ? m.alternative_titles : [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: m.status?.toLowerCase().includes("complete") ? "completed" : "ongoing",
        author: m.author ?? "Desconhecido",
        artist: m.artist,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: `${BASE_URL}/manga/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `${API_URL}/mangas/${mangaId}/chapters?limit=100&page=1`;
    const request = {
      url,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: `${BASE_URL}/catalogo`,
      },
    };

    const chapters: Chapter[] = [];

    try {
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data.chapters)
        ? data.chapters
        : Array.isArray(data.data)
          ? data.data
          : [];

      for (const c of list) {
        const chapId = String(c.id ?? "");
        if (!chapId) continue;
        const chapNum =
          typeof c.chapter_number === "number"
            ? c.chapter_number
            : parseFloat(c.number ?? c.chapter_number ?? "0");
        const title = c.title ? `Capítulo ${chapNum} - ${c.title}` : `Capítulo ${chapNum}`;

        let publishDate: Date | undefined;
        if (c.release_date || c.created_at) {
          const parsed = new Date(c.release_date || c.created_at);
          if (!isNaN(parsed.getTime())) publishDate = parsed;
        }

        chapters.push({
          chapterId: chapId,
          sourceManga,
          langCode: "PT-BR",
          chapNum: isNaN(chapNum) ? 0 : chapNum,
          title,
          volume: 0,
          publishDate,
        });
      }
    } catch (e) {
      console.error("Erro ao buscar capítulos no KuroMangas:", e);
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId.replace(/^\/?(?:chapter|chapters)\//, "");
    const url = `${API_URL}/chapters/${chapterId}`;
    const request = {
      url,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: `${BASE_URL}/catalogo`,
      },
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const rawPages = Array.isArray(data.pages)
      ? data.pages
      : Array.isArray(data.data?.pages)
        ? data.data.pages
        : [];

    const pages: string[] = [];
    for (const p of rawPages) {
      const pUrl = typeof p === "string" ? p : p.url;
      if (pUrl) {
        pages.push(buildImageUrl(pUrl));
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

export const KuroMangas = new KuroMangasExtension();
