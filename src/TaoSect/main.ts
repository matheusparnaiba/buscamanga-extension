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
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
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

    let url: string;
    if (section.id === "updates") {
      url = `${API_BASE}/projetos?orderby=modified&order=desc&per_page=20&page=${page}&_fields=id,slug,title,thumbnail`;
    } else if (section.id === "projects") {
      url = `${API_BASE}/projetos?per_page=15&page=1&_fields=id,slug,title,thumbnail`;
    } else {
      url = `${API_BASE}/projetos?per_page=20&page=${page}&_fields=id,slug,title,thumbnail`;
    }

    const req = {
      url,
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
          const imageUrl = getCoverUrl(item.thumbnail, title);

          if (section.id === "updates") {
            items.push({
              mangaId,
              chapterId: mangaId,
              title,
              subtitle: "Atualizado recentemente",
              imageUrl,
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else {
            items.push({
              mangaId,
              title,
              imageUrl,
              type: section.id === "projects" ? "prominentCarouselItem" : "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
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
    const orderBy = query.metadata?.orderBy ?? "modified";
    const order = orderBy === "title" ? "asc" : "desc";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";
    const genreParam = genre ? `&generos=${encodeURIComponent(genre)}` : "";

    const url = titleQuery
      ? `${API_BASE}/projetos?search=${encodeURIComponent(titleQuery)}&per_page=20&page=${page}&_fields=id,slug,title,thumbnail${genreParam}`
      : `${API_BASE}/projetos?orderby=${orderBy}&order=${order}&per_page=20&page=${page}&_fields=id,slug,title,thumbnail${genreParam}`;

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
    const author = info.roteiro || info.autor || "Tao Sect";
    const artist = info.arte || info.artista || author;

    const genreTags: Tag[] = [];
    if (Array.isArray(info.generos)) {
      for (const g of info.generos) {
        const name = typeof g === "string" ? g.trim() : (g?.nome || g?.name || "").trim();
        const id = typeof g === "object" && g?.id ? String(g.id) : sanitizeTagId(name);
        if (name) {
          genreTags.push({ id, title: name });
        }
      }
    }

    const tagGroups = [];
    if (genreTags.length > 0) {
      tagGroups.push({ id: "genres", title: "Gêneros", tags: genreTags });
    }
    if (info.pais?.nome) {
      tagGroups.push({
        id: "country",
        title: "País de Origem",
        tags: [{ id: sanitizeTagId(info.pais.nome), title: info.pais.nome }],
      });
    }
    if (info.status_scan?.nome) {
      tagGroups.push({
        id: "scan_status",
        title: "Status da Scan",
        tags: [{ id: sanitizeTagId(info.status_scan.nome), title: info.status_scan.nome }],
      });
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: info.titulo_pais_origem ? [info.titulo_pais_origem] : [],
        thumbnailUrl: imageUrl,
        synopsis,
        contentRating: info.mais_18 ? ContentRating.MATURE : ContentRating.EVERYONE,
        status: info.status_scan?.nome?.toLowerCase().includes("completo")
          ? "completed"
          : "ongoing",
        author,
        artist,
        tagGroups,
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
        const rawDate = ch.data_insercao || ch.created_at || ch.createdAt;
        let publishDate: Date | undefined;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) publishDate = d;
        }

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
      metadata: { orderBy: "modified", genre: "all" },
    });
  }
}

export const TaoSect = new TaoSectExtension();
