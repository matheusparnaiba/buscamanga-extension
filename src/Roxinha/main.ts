/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  CloudflareError,
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
  RoxinhaChapterDetailsDto,
  RoxinhaMangaDto,
  RoxinhaSearchMetadata,
  RoxinhaSearchResponseDto,
  RoxinhaTicketDto,
} from "./models";
import { MainInterceptor } from "./network";
import type RoxinhaConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://roxinha.online";
const API_URL = "https://roxinha.online/api";
const PAGE_SIZE = 24;

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

function cleanCoverUrl(cover?: string | null, title?: string): string {
  if (!cover || !cover.trim()) {
    return (
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(title || "Roxinha") +
      "&background=random"
    );
  }
  let src = cover.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (!src.startsWith("http")) src = `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

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

export class RoxinhaExtension
  implements
    ExtensionImpl<typeof RoxinhaConfig>,
    DiscoverSectionProviding,
    ChapterProviding,
    SearchResultsProviding
{
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { sort: "views", status: "", type: "" },
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
    const sort = section.id === "popular" ? "views" : "updated";
    const url = `${API_URL}/manga/search/advanced?limit=${PAGE_SIZE}&offset=${offset}&mode=default&sort=${sort}&order=DESC`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          referer: `${BASE_URL}/`,
          origin: BASE_URL,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: RoxinhaSearchResponseDto = JSON.parse(jsonText);
      const mangas = data.mangas ?? [];

      const items: DiscoverSectionItem[] = [];
      for (const m of mangas) {
        const mangaId = String(m.id);
        const title = m.title || "Sem título";
        const imageUrl = cleanCoverUrl(m.cover);

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
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      const hasNextPage = data.hasMore ?? mangas.length >= PAGE_SIZE;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error(`Erro ao carregar seção ${section.id} na Roxinha:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<RoxinhaSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const offset = (page - 1) * PAGE_SIZE;
    const searchTitle = query.title?.trim() ?? "";
    const sort = query.metadata?.sort ?? "views";
    const order = query.metadata?.order ?? (sort === "title" ? "ASC" : "DESC");
    const status = query.metadata?.status ?? "";
    const type = query.metadata?.type ?? "";

    const urlBuilder = new URL(`${API_URL}/manga/search/advanced`);
    urlBuilder.searchParams.set("limit", String(PAGE_SIZE));
    urlBuilder.searchParams.set("offset", String(offset));
    urlBuilder.searchParams.set("mode", "default");
    urlBuilder.searchParams.set("sort", sort);
    urlBuilder.searchParams.set("order", order);

    if (searchTitle) {
      urlBuilder.searchParams.set("q", searchTitle);
    }
    if (status) {
      urlBuilder.searchParams.set("status", status);
    }
    if (type) {
      urlBuilder.searchParams.set("type", type);
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: urlBuilder.toString(),
        method: "GET",
        headers: {
          referer: `${BASE_URL}/`,
          origin: BASE_URL,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: RoxinhaSearchResponseDto = JSON.parse(jsonText);
      const mangas = data.mangas ?? [];

      const items: SearchResultItem[] = [];
      for (const m of mangas) {
        items.push({
          mangaId: String(m.id),
          title: m.title || "Sem título",
          imageUrl: cleanCoverUrl(m.cover),
          subtitle: m.genres ?? undefined,
        });
      }

      const hasNextPage = data.hasMore ?? mangas.length >= PAGE_SIZE;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("Erro na busca da Roxinha:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const cleanId = mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/manga/${cleanId}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
        origin: BASE_URL,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: RoxinhaMangaDto = JSON.parse(jsonText);

    const title = dto.title || "Sem título";
    const author = dto.author || "Desconhecido";
    const synopsis = dto.description
      ? dto.description.replace(/<[^>]*>/g, "").trim()
      : "Sem sinopse disponível.";
    const thumbnailUrl = cleanCoverUrl(dto.cover);

    const tags: Tag[] = [];
    const seenTagIds = new Set<string>();
    if (dto.genres) {
      const splitGenres = dto.genres.split(",");
      for (const g of splitGenres) {
        const trimmed = g.trim();
        if (trimmed) {
          const id = sanitizeTagId(trimmed);
          if (!seenTagIds.has(id)) {
            seenTagIds.add(id);
            tags.push({ id, title: trimmed });
          }
        }
      }
    }

    return {
      mangaId: String(dto.id || cleanId),
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: mapStatus(dto.status),
        author,
        artist: author,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: thumbnailUrl ? [thumbnailUrl] : [],
        shareUrl: `${BASE_URL}/manga/${cleanId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const cleanId = sourceManga.mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/manga/${cleanId}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
        origin: BASE_URL,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: RoxinhaMangaDto = JSON.parse(jsonText);
    const rawChapters = dto.chapters ?? [];

    const chapters: Chapter[] = [];
    for (const ch of rawChapters) {
      const chapNum = typeof ch.chapterNumber === "number" ? ch.chapterNumber : 0;
      const title =
        ch.title && ch.title.trim() && isNaN(Number(ch.title.trim()))
          ? ch.title.trim()
          : `Capítulo ${String(chapNum).replace(/\.0$/, "")}`;

      let publishDate: Date | undefined;
      if (ch.createdAt) {
        const parsed = new Date(ch.createdAt);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: String(ch.id),
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
    const chapterId = chapter.chapterId.replace(/[^0-9]/g, "");
    const accessUrl = `${API_URL}/manga/chapter/${chapterId}/access`;

    const [accessRes, accessBuf] = await Application.scheduleRequest({
      url: accessUrl,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
        origin: BASE_URL,
      },
    });

    const accessText = Application.arrayBufferToUTF8String(accessBuf);

    if (accessRes.status === 401) {
      try {
        const errJson = JSON.parse(accessText);
        if (errJson.requiresLogin) {
          throw new CloudflareError(
            { url: `${BASE_URL}/login`, method: "GET" },
            "Login necessário na Roxinha para ler este capítulo!",
          );
        }
      } catch (err) {
        if (err instanceof CloudflareError) throw err;
      }
    }

    let ticket: string | undefined;

    try {
      const ticketDto: RoxinhaTicketDto = JSON.parse(accessText);
      ticket = ticketDto.ticket;
    } catch {
      // Ignora erro de JSON caso não venha ticket
    }

    const chapterUrl = `${API_URL}/manga/chapter/${chapterId}`;
    const chapterHeaders: Record<string, string> = {
      referer: `${BASE_URL}/`,
      origin: BASE_URL,
    };
    if (ticket) {
      chapterHeaders["x-chapter-access"] = ticket;
    }

    const [_, chapterBuf] = await Application.scheduleRequest({
      url: chapterUrl,
      method: "GET",
      headers: chapterHeaders,
    });

    const chapterText = Application.arrayBufferToUTF8String(chapterBuf);
    const chapterDto: RoxinhaChapterDetailsDto = JSON.parse(chapterText);
    const rawPages = chapterDto.pages ?? [];

    const pages: string[] = [];
    for (const p of rawPages) {
      if (typeof p === "string" && p.trim()) {
        const fullUrl = p.startsWith("http") ? p : `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
        pages.push(cleanCoverUrl(fullUrl));
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

export const Roxinha = new RoxinhaExtension();
