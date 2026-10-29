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
  ChapterDto,
  HomeMangaDto,
  OneReaderMangaDto,
  OneReaderSearchMetadata,
  PagesDto,
  SearchDto,
} from "./models";
import { MainInterceptor } from "./network";
import type OneReaderConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://onereader.net";
const API_URL = "https://api.onereader.net";
const PAGE_SIZE = 24;

function mapStatus(status?: string | null): string {
  switch (status?.trim().toLowerCase()) {
    case "em lançamento":
    case "lançando":
      return "ongoing";
    case "completo":
    case "concluído":
      return "completed";
    case "hiatus":
    case "hiato":
      return "hiatus";
    case "cancelado":
      return "cancelled";
    default:
      return "ongoing";
  }
}

export class OneReaderExtension
  implements
    ExtensionImpl<typeof OneReaderConfig>,
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
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { order: "az", status: "", type: "" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Catálogo (A-Z)",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    try {
      if (section.id === "updates") {
        const url = `${API_URL}/api/mangas/home?limit=60`;
        const [_, buffer] = await Application.scheduleRequest({
          url,
          method: "GET",
          headers: { referer: `${BASE_URL}/` },
        });

        const jsonText = Application.arrayBufferToUTF8String(buffer);
        const homeList: HomeMangaDto[] = JSON.parse(jsonText);
        const items: DiscoverSectionItem[] = [];

        if (Array.isArray(homeList)) {
          for (const m of homeList) {
            items.push({
              mangaId: m.manga_key,
              chapterId: m.manga_key,
              title: m.display_name,
              subtitle: m.status || "Atualizado",
              imageUrl: m.cover_image,
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        }

        return { items, metadata: undefined };
      }

      const url = `${API_URL}/api/mangas/search?page=${page}&limit=${PAGE_SIZE}&order=az&role=standard&search=&genre=&type=&status=`;
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: { referer: `${BASE_URL}/` },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: SearchDto = JSON.parse(jsonText);
      const mangas = data.data ?? [];

      const items: DiscoverSectionItem[] = [];
      for (const m of mangas) {
        items.push({
          mangaId: m.manga_key,
          title: m.display_name,
          imageUrl: m.cover_image,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = data.page < data.totalPages;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id} no OneReader:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<OneReaderSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchTitle = query.title?.trim() ?? "";
    const order = query.metadata?.order ?? "az";
    const status = query.metadata?.status ?? "";
    const type = query.metadata?.type ?? "";
    const genre = query.metadata?.genre ?? "";

    const urlBuilder = new URL(`${API_URL}/api/mangas/search`);
    urlBuilder.searchParams.set("page", String(page));
    urlBuilder.searchParams.set("limit", String(PAGE_SIZE));
    urlBuilder.searchParams.set("order", order);
    urlBuilder.searchParams.set("role", "standard");
    urlBuilder.searchParams.set("search", searchTitle);
    urlBuilder.searchParams.set("genre", genre);
    urlBuilder.searchParams.set("type", type);
    urlBuilder.searchParams.set("status", status);

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: urlBuilder.toString(),
        method: "GET",
        headers: { referer: `${BASE_URL}/` },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: SearchDto = JSON.parse(jsonText);
      const mangas = data.data ?? [];

      const items: SearchResultItem[] = [];
      for (const m of mangas) {
        items.push({
          mangaId: m.manga_key,
          title: m.display_name,
          imageUrl: m.cover_image,
          subtitle: m.status ?? undefined,
        });
      }

      const hasNextPage = data.page < data.totalPages;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do OneReader:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const mangaKey = mangaId.replace(/^[/#]+/, "");
    const url = `${API_URL}/api/mangas/${mangaKey}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: { referer: `${BASE_URL}/` },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: OneReaderMangaDto = JSON.parse(jsonText);

    const title = dto.display_name || dto.name || mangaKey;
    const author = dto.author || "Desconhecido";
    const artist = dto.artist || author;
    const thumbnailUrl = dto.cover_image || "";

    const tags: Tag[] = [];
    if (dto.tags && Array.isArray(dto.tags)) {
      for (const t of dto.tags) {
        if (t) tags.push({ id: t, title: t });
      }
    }

    const metadataLines: string[] = [];
    if (dto.name && dto.name.toLowerCase() !== title.toLowerCase()) {
      metadataLines.push(`Título original: ${dto.name}`);
    }
    if (dto.japanese_name) {
      metadataLines.push(`Título nativo: ${dto.japanese_name}`);
    }
    if (dto.type) metadataLines.push(`Tipo: ${dto.type}`);
    if (dto.origin_country) metadataLines.push(`País: ${dto.origin_country}`);
    if (dto.year) metadataLines.push(`Ano: ${dto.year}`);
    if (dto.publisher_name) metadataLines.push(`Editora: ${dto.publisher_name}`);

    let synopsis = dto.synopsis || "Sem sinopse disponível.";
    if (metadataLines.length > 0) {
      synopsis = `${synopsis}\n\n${metadataLines.join("\n")}`;
    }

    return {
      mangaId: dto.manga_key || mangaKey,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: dto.japanese_name ? [dto.japanese_name] : [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: mapStatus(dto.status),
        author,
        artist,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: thumbnailUrl ? [thumbnailUrl] : [],
        shareUrl: `${BASE_URL}/manga-details?id=${mangaKey}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaKey = sourceManga.mangaId.replace(/^[/#]+/, "");
    const url = `${API_URL}/api/chapters/${mangaKey}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: { referer: `${BASE_URL}/` },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const chapterMap: Record<string, ChapterDto> = JSON.parse(jsonText);

    const chapters: Chapter[] = [];
    const keys = Object.keys(chapterMap);

    for (const key of keys) {
      const chDto = chapterMap[key];
      const chapNum = parseFloat(key);
      const title = `Capítulo ${key}`;

      let publishDate: Date | undefined;
      if (chDto?.posted_date) {
        const parsed = new Date(chDto.posted_date);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: `${mangaKey}#${key}`,
        sourceManga,
        langCode: "PT-BR",
        chapNum: isNaN(chapNum) ? 0 : chapNum,
        title,
        volume: 0,
        publishDate,
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const parts = chapter.chapterId.split("#");
    const mangaKey = parts[0] ?? chapter.sourceManga.mangaId;
    const number = (parts[1] ?? String(chapter.chapNum)).replace(/\./g, "_");

    const url = `${API_URL}/api/chapters/${mangaKey}/${number}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: { referer: `${BASE_URL}/` },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const data: PagesDto = JSON.parse(jsonText);
    const rawPages = data.pages ?? [];

    const pages: string[] = [];
    for (const p of rawPages) {
      if (typeof p === "string" && p.trim()) {
        if (p.startsWith("http")) {
          pages.push(p);
        } else {
          pages.push(`${API_URL}/${p.replace(/^\/+/, "")}`);
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

export const OneReader = new OneReaderExtension();
