/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type AdvancedSearchForm,
  type Chapter,
  type ChapterDetails,
  type ChapterProviding,
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type ExtensionImpl,
  type Form,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  HipercoolChapterDto,
  HipercoolMangaHitDto,
  HipercoolPageDto,
  HipercoolSearchMetadata,
  HipercoolSearchWrapperDto,
} from "./models";
import { MainInterceptor } from "./network";
import type HipercoolConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://lerhentais.com";
const PAGE_SIZE = 30;

function mapStatus(status?: string | null): string {
  switch (status?.toLowerCase()) {
    case "ongoing":
      return "ongoing";
    case "completed":
      return "completed";
    case "hiatus":
      return "hiatus";
    case "cancelled":
      return "cancelled";
    default:
      return "ongoing";
  }
}

export class HipercoolExtension
  implements
    ExtensionImpl<typeof HipercoolConfig>,
    DiscoverSectionProviding,
    ChapterProviding,
    SearchResultsProviding
{
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 6,
    bufferInterval: 2,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
    await this.ensureSession();
  }

  private async ensureSession(): Promise<void> {
    const cookie = Application.getState("hipercool_st_cookie") as string | undefined;
    if (!cookie) {
      try {
        await Application.scheduleRequest({
          url: BASE_URL,
          method: "GET",
          headers: {
            "x-flux-node": "G2ZsDdWhUwdU82Vw",
            referer: `${BASE_URL}/`,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      } catch {
        // Ignora erro inicial de handshake de sessão
      }
    }
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { sort: "popular", type: "all", status: "all" },
    });
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
        title: "Lançamentos Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    await this.ensureSession();
    const page = metadata ?? 1;
    const sort = section.id === "popular" ? "popular" : "recent";
    const offset = (page - 1) * PAGE_SIZE;

    const trpcInput = {
      0: {
        json: {
          q: "",
          sort,
          filters: {
            genres: null,
            type: null,
            status: null,
            contentRating: null,
            author: null,
            artist: null,
            year: null,
          },
          limit: PAGE_SIZE,
          offset,
          maxRating: "pornographic",
        },
        meta: {
          values: {
            "filters.genres": ["undefined"],
            "filters.type": ["undefined"],
            "filters.status": ["undefined"],
            "filters.contentRating": ["undefined"],
            "filters.author": ["undefined"],
            "filters.artist": ["undefined"],
            "filters.year": ["undefined"],
          },
        },
      },
    };

    const url = `${BASE_URL}/api/trpc/search.query?batch=1&input=${encodeURIComponent(JSON.stringify(trpcInput))}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          "x-flux-node": "G2ZsDdWhUwdU82Vw",
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data = JSON.parse(jsonText);
      const wrapper: HipercoolSearchWrapperDto = data[0]?.result?.data?.json ?? { hits: [] };
      const hits = wrapper.hits ?? [];

      const items: DiscoverSectionItem[] = [];
      for (const hit of hits) {
        const mangaId = hit.slug;
        const title = hit.title || "Sem título";
        const imageUrl = hit.coverUrl || "";

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: "Atualizado recentemente",
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.ADULT,
          });
        } else {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "prominentCarouselItem",
            contentRating: ContentRating.ADULT,
          });
        }
      }

      const hasNextPage = hits.length >= PAGE_SIZE;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id} no Hipercool:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<HipercoolSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    await this.ensureSession();
    const page = metadata ?? 1;
    const offset = (page - 1) * PAGE_SIZE;
    const searchTitle = query.title?.trim() ?? "";
    const sort = query.metadata?.sort ?? "popular";
    const typeValue =
      query.metadata?.type && query.metadata.type !== "all" ? query.metadata.type : null;
    const statusValue =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : null;

    const valuesMeta: Record<string, string[]> = {
      "filters.genres": ["undefined"],
      "filters.contentRating": ["undefined"],
      "filters.author": ["undefined"],
      "filters.artist": ["undefined"],
      "filters.year": ["undefined"],
    };
    if (typeValue === null) valuesMeta["filters.type"] = ["undefined"];
    if (statusValue === null) valuesMeta["filters.status"] = ["undefined"];

    const trpcInput = {
      0: {
        json: {
          q: searchTitle,
          sort,
          filters: {
            genres: null,
            type: typeValue,
            status: statusValue,
            contentRating: null,
            author: null,
            artist: null,
            year: null,
          },
          limit: PAGE_SIZE,
          offset,
          maxRating: "pornographic",
        },
        meta: {
          values: valuesMeta,
        },
      },
    };

    const url = `${BASE_URL}/api/trpc/search.query?batch=1&input=${encodeURIComponent(JSON.stringify(trpcInput))}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          "x-flux-node": "G2ZsDdWhUwdU82Vw",
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data = JSON.parse(jsonText);
      const wrapper: HipercoolSearchWrapperDto = data[0]?.result?.data?.json ?? { hits: [] };
      const hits = wrapper.hits ?? [];

      const items: SearchResultItem[] = [];
      for (const hit of hits) {
        items.push({
          mangaId: hit.slug,
          title: hit.title || "Sem título",
          imageUrl: hit.coverUrl || "",
          subtitle: hit.status ?? undefined,
        });
      }

      const hasNextPage = hits.length >= PAGE_SIZE;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do Hipercool:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    await this.ensureSession();
    const slug = mangaId.replace(/^\/manga\//, "").replace(/\/$/, "");

    const trpcInput = {
      0: { json: null, meta: { values: ["undefined"] } },
      1: { json: { slug } },
    };

    const url = `${BASE_URL}/api/trpc/auth.me,series.bySlugWithGenres?batch=1&input=${encodeURIComponent(JSON.stringify(trpcInput))}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "x-flux-node": "G2ZsDdWhUwdU82Vw",
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(jsonText);
    const manga: HipercoolMangaHitDto = data[1]?.result?.data?.json;

    if (!manga) {
      throw new Error(`Obra não encontrada para o slug: ${slug}`);
    }

    const title = manga.title || "Sem título";
    const synopsis = manga.synopsis
      ? manga.synopsis.replace(/<[^>]*>/g, "").trim()
      : "Sem sinopse disponível.";
    const thumbnailUrl = manga.coverUrl || "";

    const tags: Tag[] = [];
    if (manga.genres && Array.isArray(manga.genres)) {
      for (const g of manga.genres) {
        tags.push({ id: g, title: g });
      }
    }

    const author = manga.authors?.join(", ") || "Desconhecido";
    const artist = manga.artists?.join(", ") || "Desconhecido";

    // Salvamos o ID numérico na memória de estado caso precise para os capítulos
    if (manga.id) {
      Application.setState(String(manga.id), `hipercool_id_${slug}`);
    }

    return {
      mangaId: slug,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.ADULT,
        status: mapStatus(manga.status),
        author,
        artist,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: thumbnailUrl ? [thumbnailUrl] : [],
        shareUrl: `${BASE_URL}/manga/${slug}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    await this.ensureSession();
    const slug = sourceManga.mangaId.replace(/^\/manga\//, "").replace(/\/$/, "");

    let numericId = Application.getState(`hipercool_id_${slug}`) as string | undefined;
    if (!numericId) {
      const details = await this.getMangaDetails(sourceManga.mangaId);
      numericId = Application.getState(`hipercool_id_${slug}`) as string | undefined;
      void details;
    }

    if (!numericId) {
      throw new Error(`Não foi possível determinar o ID numérico da obra: ${slug}`);
    }

    const seriesId = parseInt(numericId, 10);
    const trpcInput = {
      0: { json: { values: ["undefined"] } },
      1: {
        json: {
          seriesId,
          chapterId: null,
          sort: "best",
          page: 1,
          limit: 150,
        },
        meta: {
          values: {
            chapterId: ["undefined"],
          },
        },
      },
      2: {
        json: { seriesId },
      },
    };

    const url = `${BASE_URL}/api/trpc/auth.me,series.chapters?batch=1&input=${encodeURIComponent(JSON.stringify(trpcInput))}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "x-flux-node": "G2ZsDdWhUwdU82Vw",
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(jsonText);
    const lastEl = data[data.length - 1];
    const chaptersData: HipercoolChapterDto[] = lastEl?.result?.data?.json ?? [];

    const chapters: Chapter[] = [];
    for (const ch of chaptersData) {
      const chapNum = typeof ch.number === "number" ? ch.number : 0;
      const title = ch.title
        ? `Capítulo ${chapNum} - ${ch.title}`
        : `Capítulo ${String(chapNum).replace(/\.0$/, "")}`;

      let publishDate: Date | undefined;
      if (ch.createdAt) {
        const parsed = new Date(ch.createdAt);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: `${slug}#${ch.id}#${chapNum}`,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title,
        volume: 0,
        publishDate,
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    await this.ensureSession();
    const parts = chapter.chapterId.split("#");
    const slug = parts[0] ?? chapter.sourceManga.mangaId;
    const chapterId = parts[1] ? parseInt(parts[1], 10) : undefined;
    const chapterNumber = parts[2] ? parseFloat(parts[2]) : chapter.chapNum;

    const trpcInput = {
      0: { json: null, meta: { values: ["undefined"] } },
      1: { json: { slug } },
      2: {
        json: {
          seriesSlug: slug,
          chapterNumber,
          ...(chapterId ? { chapterId } : {}),
        },
      },
      3: { json: { position: "footer_bottom" } },
    };

    const url = `${BASE_URL}/api/trpc/auth.me,series.bySlug,reader.chapterPages?batch=1&input=${encodeURIComponent(JSON.stringify(trpcInput))}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "x-flux-node": "G2ZsDdWhUwdU82Vw",
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(jsonText);
    const lastEl = data[data.length - 1];
    const pagesDto: HipercoolPageDto[] = lastEl?.result?.data?.json ?? [];

    const pages: string[] = [];
    for (const p of pagesDto) {
      const pageUrl = p.avifUrl || p.webpUrl;
      if (pageUrl) pages.push(pageUrl);
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

export const Hipercool = new HipercoolExtension();
