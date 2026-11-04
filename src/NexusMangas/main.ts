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
  const clean = coverUrl.startsWith("/") ? coverUrl.slice(1) : coverUrl;
  return `https://assets.nexusmangas.com/${clean}`;
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

function mapContentRating(rating: string | null | undefined): ContentRating {
  switch (rating?.toUpperCase()) {
    case "ADULT":
    case "EROTICA":
    case "PORNOGRAPHIC":
    case "SEXUAL_VIOLENCE":
      return ContentRating.ADULT;
    case "SUGGESTIVE":
    case "GORE":
      return ContentRating.MATURE;
    default:
      return ContentRating.EVERYONE;
  }
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Agora";
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) return `Há ${diffMins || 1} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Há ${diffDays}d`;
  return d.toLocaleDateString("pt-BR");
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
        title: "Destaques & Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "newest",
        title: "Recém Adicionados",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "manhwa",
        title: "Manhwas",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "manga",
        title: "Mangás",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "action",
        title: "Ação & Aventura",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "romance",
        title: "Romance & Drama",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "adult",
        title: "Adulto (+18)",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    try {
      if (section.id === "updates") {
        const url = `${REST_URL}/chapters?select=id,number,title,published_at,works!chapters_work_id_fkey!inner(slug,title,cover_url,type,content_rating)&order=published_at.desc&limit=${PAGE_SIZE}&offset=${offset}`;
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
        const list = Array.isArray(data) ? data : [];
        const items: DiscoverSectionItem[] = [];

        for (const c of list) {
          const w = c.works;
          if (!w || !w.slug) continue;
          const mangaId = w.slug;
          const chapterId = c.id;
          const title = w.title ?? mangaId;
          const img = buildImageUrl(w.cover_url);
          const chapNum = typeof c.number === "number" ? c.number : parseFloat(c.number ?? "0");
          const chapLabel = c.title ? `Cap. ${chapNum} - ${c.title}` : `Cap. ${chapNum}`;
          const time = formatRelativeTime(c.published_at);
          const subtitle = time ? `${chapLabel} • ${time}` : chapLabel;

          items.push({
            mangaId,
            chapterId,
            title,
            subtitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "chapterUpdatesCarouselItem",
            contentRating: mapContentRating(w.content_rating),
          });
        }

        return {
          items,
          metadata: list.length === PAGE_SIZE ? page + 1 : undefined,
        };
      }

      // Works-based sections
      const params = new URLSearchParams();

      if (section.id === "popular") {
        params.set("select", "slug,title,cover_url,status,type,avg_rating,content_rating");
        params.set("order", "avg_rating.desc.nullslast,rating_count.desc.nullslast,id.desc");
      } else if (section.id === "newest") {
        params.set("select", "slug,title,cover_url,status,type,avg_rating,content_rating");
        params.set("order", "created_at.desc,id.desc");
      } else if (section.id === "manhwa") {
        params.set("select", "slug,title,cover_url,status,type,avg_rating,content_rating");
        params.set("type", "eq.MANHWA");
        params.set("order", "avg_rating.desc.nullslast,id.desc");
      } else if (section.id === "manga") {
        params.set("select", "slug,title,cover_url,status,type,avg_rating,content_rating");
        params.set("type", "eq.MANGA");
        params.set("order", "avg_rating.desc.nullslast,id.desc");
      } else if (section.id === "action") {
        params.set(
          "select",
          "slug,title,cover_url,status,type,avg_rating,content_rating,work_genres!inner(genres!inner(name))",
        );
        params.set("work_genres.genres.name", "eq.Ação");
        params.set("order", "avg_rating.desc.nullslast,id.desc");
      } else if (section.id === "romance") {
        params.set(
          "select",
          "slug,title,cover_url,status,type,avg_rating,content_rating,work_genres!inner(genres!inner(name))",
        );
        params.set("work_genres.genres.name", "eq.Romance");
        params.set("order", "avg_rating.desc.nullslast,id.desc");
      } else if (section.id === "adult") {
        params.set("select", "slug,title,cover_url,status,type,content_rating");
        params.set("or", "(content_rating.eq.ADULT,content_rating.eq.EROTICA)");
        params.set("order", "updated_at.desc,id.desc");
      } else {
        params.set("select", "slug,title,cover_url,status,type,avg_rating,content_rating");
        params.set("order", "avg_rating.desc.nullslast,id.desc");
      }

      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const queryString = params.toString().replace(/%2C/g, ",");
      const request = {
        url: `${REST_URL}/works?${queryString}`,
        method: "GET",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          Accept: "application/json",
        },
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const list = Array.isArray(data) ? data : [];
      const items: DiscoverSectionItem[] = [];

      for (const w of list) {
        const mangaId = w.slug;
        if (!mangaId) continue;
        const mangaTitle = w.title ?? mangaId;
        const img = buildImageUrl(w.cover_url);
        const ratingStr = w.avg_rating ? `★ ${w.avg_rating}` : undefined;
        const subtitle = [ratingStr, w.type].filter(Boolean).join(" • ") || undefined;
        const contentRating =
          section.id === "adult" ? ContentRating.ADULT : mapContentRating(w.content_rating);

        if (section.id === "popular") {
          items.push({
            mangaId,
            title: mangaTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(mangaTitle) +
                "&background=random",
            subtitle,
            type: "prominentCarouselItem",
            contentRating,
          });
        } else {
          items.push({
            mangaId,
            title: mangaTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(mangaTitle) +
                "&background=random",
            subtitle,
            type: "simpleCarouselItem",
            contentRating,
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
    params.append("select", `slug,title,cover_url,status,type,content_rating${genreJoin}`);
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

    const queryString = params.toString().replace(/%2C/g, ",");
    const url = `${REST_URL}/works?${queryString}`;
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
        const contentRating = mapContentRating(w.content_rating);

        items.push({
          mangaId,
          title: mangaTitle,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(mangaTitle) +
              "&background=random",
          contentRating,
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
    const url = `${REST_URL}/works?select=slug,title,description,cover_url,alternative_title,status,type,author,artist,demographic,content_rating,work_genres(genres(name))&slug=eq.${mangaId}&limit=1`;
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
    const contentRating = mapContentRating(work.content_rating);

    const genres: Tag[] = [];
    if (work.type) {
      genres.push({ id: sanitizeTagId(work.type), title: work.type });
    }
    if (work.demographic && work.demographic !== "NONE") {
      genres.push({ id: sanitizeTagId(work.demographic), title: work.demographic });
    }
    if (Array.isArray(work.work_genres)) {
      for (const wg of work.work_genres) {
        const gName = wg.genres?.name;
        if (gName) {
          genres.push({ id: sanitizeTagId(gName), title: gName });
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
        contentRating,
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
