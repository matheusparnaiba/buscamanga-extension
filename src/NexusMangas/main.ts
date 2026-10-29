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
import type { NexusMangasSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type NexusMangasConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://www.nexusmangas.com";
const REST_URL = "https://supabase.nexusmangas.com/rest/v1";
const FUNCTIONS_URL = "https://supabase.nexusmangas.com/functions/v1";
const ANON_KEY =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NzgwMjAwMCwiZXhwIjo0OTQzNDc1NjAwLCJyb2xlIjoiYW5vbiJ9." +
  "Cnl8Jw2DeKe84OAkmJYfO33xlcZsw0TC2Nw_il0tpRs";

const PAGE_SIZE = 30;

function buildImageUrl(coverUrl: string | null | undefined): string {
  if (!coverUrl) return "";
  if (coverUrl.startsWith("http")) return coverUrl;
  return `${FUNCTIONS_URL}/read-public-media?key=${encodeURIComponent(coverUrl)}`;
}

function mapStatus(status: string | null | undefined): string {
  switch (status?.toUpperCase()) {
    case "RELEASING":
      return "ongoing";
    case "COMPLETED":
      return "completed";
    case "HIATUS":
      return "hiatus";
    case "CANCELLED":
      return "cancelled";
    default:
      return "ongoing";
  }
}

export class NexusMangasExtension implements ExtensionImpl<typeof NexusMangasConfig> {
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
    const offset = (page - 1) * PAGE_SIZE;
    const order =
      section.id === "popular" ? "avg_rating.desc.nullslast,id.desc" : "updated_at.desc,id.desc";

    const url = `${REST_URL}/works?select=slug,title,cover_url,status,type&order=${order}&limit=${PAGE_SIZE}&offset=${offset}`;

    const request = {
      url,
      method: "GET",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
      },
    };

    const items: DiscoverSectionItem[] = [];

    try {
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data) ? data : [];

      for (const w of list) {
        const mangaId = w.slug;
        if (!mangaId) continue;
        const title = w.title ?? mangaId;
        const img = buildImageUrl(w.cover_url);

        if (section.id === "popular") {
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
        } else {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: w.type ?? undefined,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      return {
        items,
        metadata: list.length === PAGE_SIZE ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.title}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { order: "updated_at.desc" },
    });
  }

  async getSearchResults(
    query: SearchQuery<NexusMangasSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const offset = (page - 1) * PAGE_SIZE;
    const title = query.title?.trim() ?? "";
    const order = query.metadata?.order ?? "updated_at.desc";
    const type = query.metadata?.type && query.metadata.type !== "all" ? query.metadata.type : "";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const demographic =
      query.metadata?.demographic && query.metadata.demographic !== "all"
        ? query.metadata.demographic
        : "";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";

    const genreJoin = genre ? ",work_genres!inner(genres!inner(name))" : "";
    const params = new URLSearchParams();
    params.append("select", `slug,title,cover_url,status,type${genreJoin}`);
    params.append("order", `${order},id.desc`);
    params.append("limit", String(PAGE_SIZE));
    params.append("offset", String(offset));

    if (title) {
      const sanitized = title.replace(/[,()*]/g, " ").trim();
      if (sanitized) {
        params.append("or", `(title.ilike.*${sanitized}*,alternative_title.ilike.*${sanitized}*)`);
      }
    }

    if (type) params.append("type", `eq.${type}`);
    if (status) params.append("status", `eq.${status}`);
    if (demographic) params.append("demographic", `eq.${demographic}`);
    if (genre) params.append("work_genres.genres.name", `eq.${genre}`);

    const url = `${REST_URL}/works?${params.toString()}`;
    const request = {
      url,
      method: "GET",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
      },
    };

    const items: SearchResultItem[] = [];

    try {
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data) ? data : [];

      for (const w of list) {
        const mangaId = w.slug;
        if (!mangaId) continue;
        const mangaTitle = w.title ?? mangaId;
        const img = buildImageUrl(w.cover_url);

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

      return {
        items,
        metadata: list.length === PAGE_SIZE ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao buscar no NexusMangas:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${REST_URL}/works?select=slug,title,description,cover_url,alternative_title,status,type,author,artist,demographic,work_genres(genres(name))&slug=eq.${mangaId}&limit=1`;
    const request = {
      url,
      method: "GET",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
      },
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const work = Array.isArray(data) ? data[0] : undefined;

    if (!work) {
      throw new Error(`Obra ${mangaId} não encontrada no NexusMangas`);
    }

    const title = work.title ?? mangaId;
    const image = buildImageUrl(work.cover_url);
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis = work.description ?? "";
    const status = mapStatus(work.status);

    const genres: Tag[] = [];
    if (work.type) {
      genres.push({ id: work.type.toLowerCase(), title: work.type });
    }
    if (work.demographic && work.demographic !== "NONE") {
      genres.push({ id: work.demographic.toLowerCase(), title: work.demographic });
    }
    if (Array.isArray(work.work_genres)) {
      for (const wg of work.work_genres) {
        const gName = wg.genres?.name;
        if (gName) {
          genres.push({
            id: gName.toLowerCase().replace(/\s+/g, "-"),
            title: gName,
          });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: work.alternative_title ? [work.alternative_title] : [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: work.author ?? "Desconhecido",
        artist: work.artist,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: `${BASE_URL}/obra/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId;
    const url = `${REST_URL}/chapters?select=id,number,title,published_at,works!chapters_work_id_fkey!inner(slug)&works.slug=eq.${slug}&order=number.desc&limit=1000`;

    const request = {
      url,
      method: "GET",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
      },
    };

    const chapters: Chapter[] = [];

    try {
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data) ? data : [];

      for (const c of list) {
        const chapId = c.id;
        if (!chapId) continue;
        const chapNum = typeof c.number === "number" ? c.number : parseFloat(c.number ?? "0");
        const title = c.title ? `Capítulo ${chapNum} - ${c.title}` : `Capítulo ${chapNum}`;

        let publishDate: Date | undefined;
        if (c.published_at) {
          const parsed = new Date(c.published_at);
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
      console.error("Erro ao buscar capítulos no NexusMangas:", e);
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId;
    const request = {
      url: `${FUNCTIONS_URL}/read-chapter`,
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        "x-nexus-client": "reader-v3",
      },
      body: JSON.stringify({ chapterId }),
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));

    const pages: string[] = [];
    const rawPages = data.chapter?.pages ?? [];

    for (const p of rawPages) {
      if (typeof p === "string" && p.startsWith("http")) {
        pages.push(p);
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

export const NexusMangas = new NexusMangasExtension();
