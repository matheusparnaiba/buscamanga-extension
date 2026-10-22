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

const API_BASE = "https://api2.manhastro.net";
const SITE_BASE = "https://manhastro.com";

function cleanJson(body: string): any {
  const cleaned = body
    .replace(/^[\uFEFF\s]+/, "")
    .replace(/^\)]}'/, "")
    .replace(/^[,_]/, "")
    .trim();
  return JSON.parse(cleaned);
}

function getCoverUrl(imagem: string | null | undefined, title: string): string {
  if (!imagem) {
    return "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
  }
  if (imagem.startsWith("http://") || imagem.startsWith("https://")) {
    return imagem;
  }
  return "https://" + imagem.replace(/^\/+/, "");
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

export class ManhastroExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "ranking",
        title: "Mais Lidos (Ranking Diário)",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
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

    if (section.id === "ranking") {
      if (page > 1) return { items: [], metadata: undefined };

      const request = {
        url: `${API_BASE}/rank/diario`,
        method: "GET",
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const json = cleanJson(data);
      const items: DiscoverSectionItem[] = [];

      for (const item of json.data || []) {
        const mangaId = String(item.manga_id);
        const title = item.titulo_brasil || item.titulo || mangaId;
        const imageUrl = getCoverUrl(item.cover_pro || item.imagem, title);

        items.push({
          mangaId,
          title,
          subtitle: item.generos ? item.generos.slice(0, 2).join(", ") : undefined,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: item.adulta ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
      }

      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      if (page > 1) {
        // Fallback to paginated data for subsequent pages
        const request = {
          url: `${API_BASE}/dados?page=${page}&sort=lancamento&order=desc`,
          method: "GET",
        };
        const [_, buffer] = await Application.scheduleRequest(request);
        const data = Application.arrayBufferToUTF8String(buffer);
        const json = cleanJson(data);
        const items: DiscoverSectionItem[] = [];

        for (const item of json.data || []) {
          const mangaId = String(item.manga_id);
          const title = item.titulo_brasil || item.titulo || mangaId;
          const imageUrl = getCoverUrl(item.cover_pro || item.imagem, title);

          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: item.adulta ? ContentRating.ADULT : ContentRating.EVERYONE,
          });
        }

        return {
          items,
          metadata: json.meta?.hasMore || items.length >= 20 ? page + 1 : undefined,
        };
      }

      const request = {
        url: `${API_BASE}/lancamentos`,
        method: "GET",
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const json = cleanJson(data);
      const items: DiscoverSectionItem[] = [];
      const seen = new Set<string>();

      for (const item of json.data || []) {
        const mangaId = String(item.manga_id);
        if (seen.has(mangaId)) continue;
        seen.add(mangaId);

        const title = item.titulo_brasil || item.titulo || mangaId;
        const imageUrl = getCoverUrl(item.cover_pro || item.imagem, title);
        const subtitle = item.qnt_capitulo ? `Cap. ${item.qnt_capitulo}` : undefined;

        items.push({
          mangaId,
          chapterId: mangaId,
          title,
          subtitle,
          imageUrl,
          type: "chapterUpdatesCarouselItem",
          contentRating: item.adulta ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
      }

      return {
        items,
        metadata: page + 1,
      };
    }

    return { items: [], metadata: undefined };
  }

  async getSearchFilters(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    let url: string;

    if (query.title && query.title.trim()) {
      url = `${API_BASE}/dados?nome=${encodeURIComponent(query.title.trim())}&page=${page}`;
    } else {
      url = `${API_BASE}/dados?page=${page}&sort=views&order=desc`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const items: SearchResultItem[] = [];

    for (const item of json.data || []) {
      const mangaId = String(item.manga_id);
      const title = item.titulo_brasil || item.titulo || mangaId;
      const imageUrl = getCoverUrl(item.cover_pro || item.imagem, title);

      items.push({
        mangaId,
        title,
        imageUrl,
        contentRating: item.adulta ? ContentRating.ADULT : ContentRating.EVERYONE,
      });
    }

    return {
      items,
      metadata: json.meta?.hasMore || (json.data && json.data.length >= 20) ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = {
      url: `${API_BASE}/dados?manga_id=${mangaId}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const item = (json.data && json.data[0]) || {};

    const title = item.titulo_brasil || item.titulo || mangaId;
    const secondaryTitles: string[] = [];
    if (item.titulo && item.titulo !== title) secondaryTitles.push(item.titulo);
    if (Array.isArray(item.titulo_alternative)) {
      for (const alt of item.titulo_alternative) {
        if (alt && !secondaryTitles.includes(alt)) secondaryTitles.push(alt);
      }
    }

    const imageUrl = getCoverUrl(item.cover_pro || item.imagem, title);
    const synopsis = item.descricao_brasil || item.descricao || "";

    let status = "ONGOING";
    if (item.status === "end" || item.status === "completed") {
      status = "COMPLETED";
    }

    const genres: Tag[] = [];
    if (Array.isArray(item.generos)) {
      for (const g of item.generos) {
        if (g) {
          genres.push({ id: sanitizeTagId(g), title: g });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles,
        thumbnailUrl: imageUrl,
        synopsis,
        contentRating: item.adulta ? ContentRating.ADULT : ContentRating.EVERYONE,
        status,
        author: item.autor || item.author || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Genres", tags: genres }],
        artworkUrls: [imageUrl],
        shareUrl: `${SITE_BASE}/manga/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const request = {
      url: `${API_BASE}/dados/${mangaId}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);
    const chapters: Chapter[] = [];

    for (const item of json.data || []) {
      const chapId = String(item.capitulo_id || item.capituloId);
      const name = item.capitulo_nome || item.capituloNome || `Capítulo ${chapId}`;

      const numMatch = name.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

      let time: Date | undefined;
      const dateStr = item.capitulo_data || item.capituloData;
      if (dateStr) {
        time = new Date(dateStr);
      }

      chapters.push({
        chapterId: chapId,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title: name,
        volume: 0,
        publishDate: time,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapId = chapter.chapterId;
    const request = {
      url: `${API_BASE}/paginas/${chapId}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);

    const pages: string[] = [];
    const chapterData = json.data?.chapter;

    if (chapterData && chapterData.baseUrl && chapterData.hash && Array.isArray(chapterData.data)) {
      const base = chapterData.baseUrl.replace(/\/+$/, "");
      const hash = chapterData.hash.replace(/^\/+|\/+$/g, "");

      for (const filename of chapterData.data) {
        if (filename) {
          pages.push(`${base}/${hash}/${filename}`);
        }
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

export const Manhastro = new ManhastroExtension();
