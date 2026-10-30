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
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

const API_BASE = "https://api.mangaflix.net/v1";
const SITE_BASE = "https://mangaflix.net";

function getCoverUrl(posterUrl: string | null | undefined, title: string): string {
  if (!posterUrl) {
    return "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
  }
  try {
    return encodeURI(decodeURI(posterUrl.trim()));
  } catch {
    return posterUrl.trim().replace(/\s+/g, "%20");
  }
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

export class MangaFlixExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "most-read",
        title: "Mais Lidos",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "trending",
        title: "Em Alta",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "latest",
        title: "Últimos Lançamentos",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if (section.id === "most-read" || section.id === "trending") {
      if (page > 1) return { items: [], metadata: undefined };

      const req = {
        url: `${API_BASE}/browse`,
        method: "GET",
      };

      try {
        const [_, buffer] = await Application.scheduleRequest(req);
        const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        const sectionData = data.data?.find((s: any) => s.key === section.id);
        const items: DiscoverSectionItem[] = [];

        if (sectionData && Array.isArray(sectionData.items)) {
          for (const item of sectionData.items) {
            const title = item.name || "Sem título";
            items.push({
              mangaId: item._id,
              title,
              imageUrl: getCoverUrl(item.poster?.default_url, title),
              type: section.id === "most-read" ? "prominentCarouselItem" : "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        }

        return { items, metadata: undefined };
      } catch (e) {
        console.error(`Erro ao carregar seção ${section.id}:`, e);
        return { items: [], metadata: undefined };
      }
    }

    if (section.id === "latest") {
      if (page > 5) return { items: [], metadata: undefined };

      const req = {
        url: `${API_BASE}/latest-releases?selected_language=pt-br`,
        method: "GET",
      };

      try {
        const [_, buffer] = await Application.scheduleRequest(req);
        const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        const items: DiscoverSectionItem[] = [];
        const seen = new Set<string>();

        if (Array.isArray(data.data)) {
          for (const item of data.data) {
            if (item._id && !seen.has(item._id)) {
              seen.add(item._id);
              const title = item.name || "Sem título";
              const latestChap = item.chapters?.[0]?.number;
              const chapterId = item.chapters?.[0]?._id || item._id;
              items.push({
                mangaId: item._id,
                chapterId,
                title,
                imageUrl: getCoverUrl(item.poster?.default_url, title),
                subtitle: latestChap !== undefined ? `Capítulo ${latestChap}` : undefined,
                type: "chapterUpdatesCarouselItem",
                contentRating: ContentRating.EVERYONE,
              });
            }
          }
        }

        return { items, metadata: undefined };
      } catch (e) {
        console.error("Erro ao carregar últimos lançamentos:", e);
        return { items: [], metadata: undefined };
      }
    }

    return { items: [], metadata: undefined };
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const titleQuery = query.title?.trim() ?? "";

    if (!titleQuery) {
      const browseRes = await this.getDiscoverSectionItems(
        { id: "most-read", title: "Mais Lidos", type: DiscoverSectionType.prominentCarousel },
        page,
      );
      return {
        items: browseRes.items.map((i: any) => ({
          mangaId: i.mangaId,
          title: i.title,
          imageUrl: i.imageUrl,
          contentRating: ContentRating.EVERYONE,
        })),
        metadata: undefined,
      };
    }

    const req = {
      url: `${API_BASE}/search/mangas?query=${encodeURIComponent(titleQuery)}&selected_language=pt-br`,
      method: "GET",
    };

    try {
      const [_, buffer] = await Application.scheduleRequest(req);
      const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const items: SearchResultItem[] = [];
      const works = data.data?.works ?? [];

      for (const w of works) {
        const title = w.name || "Sem título";
        items.push({
          mangaId: w._id,
          title,
          imageUrl: getCoverUrl(w.poster?.default_url, title),
          subtitle: w.genres
            ?.map((g: any) => g.name)
            .slice(0, 2)
            .join(", "),
          contentRating: ContentRating.EVERYONE,
        });
      }

      return { items, metadata: undefined };
    } catch (e) {
      console.error("Erro na busca MangaFlix:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const req = {
      url: `${API_BASE}/mangas/${mangaId}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const details = data.data ?? {};

    const title = details.name || "Sem título";
    const imageUrl = getCoverUrl(details.poster?.default_url, title);
    const synopsis = details.description || "";
    const author = details.chapters?.[0]?.owners?.[0]?.name || "Desconhecido";

    const tags: Tag[] = [];
    if (Array.isArray(details.genres)) {
      for (const g of details.genres) {
        if (g.name) {
          tags.push({
            id: sanitizeTagId(g.name),
            title: g.name,
          });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: imageUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "ongoing",
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags }],
        artworkUrls: [imageUrl],
        shareUrl: `${SITE_BASE}/br/manga/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const req = {
      url: `${API_BASE}/mangas/${mangaId}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const chaptersList = data.data?.chapters ?? [];
    const chapters: Chapter[] = [];

    for (const ch of chaptersList) {
      const num = typeof ch.number === "number" ? ch.number : parseFloat(ch.number) || 0;
      const title = ch.name ? `Capítulo ${num} - ${ch.name}` : `Capítulo ${num}`;
      const rawDate = ch.iso_date || ch.createdAt || ch.created_at || ch.releaseDate;
      let publishDate: Date | undefined;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) publishDate = d;
      }

      chapters.push({
        chapterId: ch._id,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num,
        title,
        volume: 0,
        publishDate,
      });
    }

    // Ordenar decrescente
    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId;
    const req = {
      url: `${API_BASE}/chapters/${chapterId}?selected_language=pt-br`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const data = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const images = data.data?.images ?? [];
    const pages: string[] = [];

    for (const img of images) {
      if (img.default_url) {
        pages.push(img.default_url);
      }
    }

    return {
      id: chapterId,
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { mode: "include" },
    });
  }
}

export const MangaFlix = new MangaFlixExtension();
