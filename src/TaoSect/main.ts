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

const SITE_BASE = "https://taosect.com";
const API_BASE = "https://taosect.com/wp-json/wp/v2";

function getCoverUrl(thumbnail: string | null | undefined, title: string): string {
  if (!thumbnail) {
    return "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
  }
  return thumbnail;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
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

export class TaoSectExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "projects",
        title: "Obras em Destaque",
        type: DiscoverSectionType.prominentCarousel,
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
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    const req = {
      url: `${API_BASE}/projetos?per_page=20&page=${page}&_fields=id,slug,title,thumbnail`,
      method: "GET",
    };

    try {
      const [_, buffer] = await Application.scheduleRequest(req);
      const list = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const items: DiscoverSectionItem[] = [];

      if (Array.isArray(list)) {
        for (const item of list) {
          const title = cleanHtml(item.title?.rendered || "Sem título");
          const mangaId = String(item.id);
          items.push({
            mangaId,
            title,
            imageUrl: getCoverUrl(item.thumbnail, title),
            type: section.id === "projects" ? "prominentCarouselItem" : "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      return {
        items,
        metadata: items.length >= 20 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const titleQuery = query.title?.trim() ?? "";

    const url = titleQuery
      ? `${API_BASE}/projetos?search=${encodeURIComponent(titleQuery)}&per_page=20&page=${page}&_fields=id,slug,title,thumbnail`
      : `${API_BASE}/projetos?per_page=20&page=${page}&_fields=id,slug,title,thumbnail`;

    const req = { url, method: "GET" };

    try {
      const [_, buffer] = await Application.scheduleRequest(req);
      const list = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const items: SearchResultItem[] = [];

      if (Array.isArray(list)) {
        for (const item of list) {
          const title = cleanHtml(item.title?.rendered || "Sem título");
          items.push({
            mangaId: String(item.id),
            title,
            imageUrl: getCoverUrl(item.thumbnail, title),
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      return {
        items,
        metadata: items.length >= 20 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca TaoSect:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const req = {
      url: `${API_BASE}/projetos/${mangaId}?_fields=id,slug,title,content,thumbnail,informacoes`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const item = JSON.parse(Application.arrayBufferToUTF8String(buffer));

    const title = cleanHtml(item.title?.rendered || "Sem título");
    const imageUrl = getCoverUrl(item.thumbnail, title);
    const synopsis = cleanHtml(item.content?.rendered || "");
    const info = item.informacoes ?? {};
    const author = info.autor || info.artista || "Tao Sect";

    const tags: Tag[] = [];
    if (Array.isArray(info.generos)) {
      for (const g of info.generos) {
        if (typeof g === "string" && g.trim()) {
          tags.push({
            id: sanitizeTagId(g),
            title: g.trim(),
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
        status: info.status?.toLowerCase().includes("completo") ? "completed" : "ongoing",
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags }],
        artworkUrls: [imageUrl],
        shareUrl: `${SITE_BASE}/projeto/${item.slug || mangaId}/`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const req = {
      url: `${API_BASE}/capitulos?post_id=${mangaId}&per_page=100&_fields=id_capitulo,nome_capitulo,sequencia,slug,data_insercao,paginas`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const list = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const chapters: Chapter[] = [];

    if (Array.isArray(list)) {
      for (const ch of list) {
        const id = ch.id_capitulo ? String(ch.id_capitulo) : String(ch.slug);
        const name = ch.nome_capitulo || `Capítulo ${ch.sequencia || ""}`;
        const numMatch = name.match(/[\d.]+/);
        const chapNum = numMatch ? parseFloat(numMatch[0]) : parseFloat(ch.sequencia) || 0;
        const publishDate = ch.data_insercao ? new Date(ch.data_insercao) : undefined;

        chapters.push({
          chapterId: id,
          sourceManga,
          langCode: "PT-BR",
          chapNum,
          title: name,
          volume: 0,
          publishDate,
        });
      }
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId;
    const req = {
      url: `${API_BASE}/capitulos/${chapterId}?_fields=id_capitulo,paginas`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(req);
    const ch = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const rawPages = ch.paginas ?? [];
    const pages: string[] = [];

    if (Array.isArray(rawPages)) {
      for (const p of rawPages) {
        if (typeof p === "string" && p.startsWith("http")) {
          pages.push(p);
        }
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

export const TaoSect = new TaoSectExtension();
