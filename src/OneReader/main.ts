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
  OneReaderCatalogResponse,
  OneReaderChapterDetailResponse,
  OneReaderSearchMetadata,
  OneReaderSearchResponse,
  OneReaderUpdatesResponse,
  OneReaderWorkDetailResponse,
} from "./models";
import { MainInterceptor } from "./network";
import type OneReaderConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://onereader.net";
const PAGE_SIZE = 24;

function sanitizeImageUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
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
    numberOfRequests: 8,
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
        const url = `${BASE_URL}/api/reader/home/updates?page=${page}`;
        const [_, buffer] = await Application.scheduleRequest({
          url,
          method: "GET",
          headers: { referer: `${BASE_URL}/` },
        });

        const jsonText = Application.arrayBufferToUTF8String(buffer);
        const data: OneReaderUpdatesResponse = JSON.parse(jsonText);
        const items: DiscoverSectionItem[] = [];

        if (Array.isArray(data.items)) {
          for (const m of data.items) {
            const mangaId = m.slug || m.id;
            const subtitle =
              m.latestChapterNumber != null
                ? `Capítulo ${m.latestChapterNumber}`
                : m.status || "Atualizado";

            items.push({
              mangaId,
              chapterId: mangaId,
              title: m.title,
              subtitle,
              imageUrl: sanitizeImageUrl(m.coverUrl),
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        }

        const hasNextPage = data.pagination ? data.pagination.page < data.pagination.pages : false;

        return { items, metadata: hasNextPage ? page + 1 : undefined };
      }

      // Catálogo (A-Z)
      const url = `${BASE_URL}/api/reader/catalog`;
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: { referer: `${BASE_URL}/acervo` },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: OneReaderCatalogResponse = JSON.parse(jsonText);
      const allWorks = data.works ?? [];

      const start = (page - 1) * PAGE_SIZE;
      const pageWorks = allWorks.slice(start, start + PAGE_SIZE);

      const items: DiscoverSectionItem[] = [];
      for (const m of pageWorks) {
        items.push({
          mangaId: m.slug || m.id,
          title: m.title,
          imageUrl: sanitizeImageUrl(m.coverUrl),
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = start + PAGE_SIZE < allWorks.length;
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
    const status = query.metadata?.status ?? "";
    const type = query.metadata?.type ?? "";
    const genre = query.metadata?.genre ?? "";

    try {
      if (searchTitle) {
        const url = `${BASE_URL}/api/reader/search?q=${encodeURIComponent(searchTitle)}`;
        const [_, buffer] = await Application.scheduleRequest({
          url,
          method: "GET",
          headers: { referer: `${BASE_URL}/` },
        });

        const jsonText = Application.arrayBufferToUTF8String(buffer);
        const data: OneReaderSearchResponse = JSON.parse(jsonText);
        let works = data.works ?? [];

        if (status) {
          works = works.filter((w) => w.status?.toLowerCase().includes(status.toLowerCase()));
        }
        if (type) {
          works = works.filter((w) => w.type?.toLowerCase().includes(type.toLowerCase()));
        }
        if (genre) {
          works = works.filter((w) =>
            w.genres?.some((g) => g.toLowerCase().includes(genre.toLowerCase())),
          );
        }

        const items: SearchResultItem[] = [];
        for (const m of works) {
          items.push({
            mangaId: m.slug || m.id,
            title: m.title,
            imageUrl: sanitizeImageUrl(m.coverUrl),
            subtitle: m.status ?? undefined,
          });
        }

        return { items, metadata: undefined };
      }

      // Se não digitou termo, busca no catálogo completo
      const url = `${BASE_URL}/api/reader/catalog`;
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: { referer: `${BASE_URL}/acervo` },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: OneReaderCatalogResponse = JSON.parse(jsonText);
      let works = data.works ?? [];

      if (status) {
        works = works.filter((w) => w.status?.toLowerCase().includes(status.toLowerCase()));
      }
      if (type) {
        works = works.filter((w) => w.type?.toLowerCase().includes(type.toLowerCase()));
      }
      if (genre) {
        works = works.filter((w) =>
          w.genres?.some((g) => g.toLowerCase().includes(genre.toLowerCase())),
        );
      }

      const start = (page - 1) * PAGE_SIZE;
      const pageWorks = works.slice(start, start + PAGE_SIZE);

      const items: SearchResultItem[] = [];
      for (const m of pageWorks) {
        items.push({
          mangaId: m.slug || m.id,
          title: m.title,
          imageUrl: sanitizeImageUrl(m.coverUrl),
          subtitle: m.status ?? undefined,
        });
      }

      const hasNextPage = start + PAGE_SIZE < works.length;
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
    const url = `${BASE_URL}/api/reader/works/${encodeURIComponent(mangaKey)}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: { referer: `${BASE_URL}/obra?id=${encodeURIComponent(mangaKey)}` },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: OneReaderWorkDetailResponse = JSON.parse(jsonText);
    const work = dto.work || (dto as any);

    const title = work.title || mangaKey;
    const author = work.author || "Desconhecido";
    const artist = work.artist || author;
    const thumbnailUrl = sanitizeImageUrl(work.coverUrl);

    const tags: Tag[] = [];
    const seenTagIds = new Set<string>();
    if (work.genres && Array.isArray(work.genres)) {
      for (const t of work.genres) {
        if (t && typeof t === "string" && t.trim()) {
          const id = sanitizeTagId(t);
          if (!seenTagIds.has(id)) {
            seenTagIds.add(id);
            tags.push({ id, title: t.trim() });
          }
        }
      }
    }

    const metadataLines: string[] = [];
    if (work.originalName && work.originalName.toLowerCase() !== title.toLowerCase()) {
      metadataLines.push(`Título original: ${work.originalName}`);
    }
    if (work.nativeTitle) {
      metadataLines.push(`Título nativo: ${work.nativeTitle}`);
    }
    if (work.englishTitle) {
      metadataLines.push(`Título inglês: ${work.englishTitle}`);
    }
    if (work.portugueseTitle) {
      metadataLines.push(`Título em português: ${work.portugueseTitle}`);
    }
    if (work.type) metadataLines.push(`Tipo: ${work.type}`);
    if (work.releaseYear) metadataLines.push(`Ano: ${work.releaseYear}`);
    if (work.publisher) metadataLines.push(`Editora: ${work.publisher}`);

    let synopsis = work.synopsis || "Sem sinopse disponível.";
    if (metadataLines.length > 0) {
      synopsis = `${synopsis}\n\n${metadataLines.join("\n")}`;
    }

    const secondaryTitles = [
      work.originalName,
      work.nativeTitle,
      work.englishTitle,
      work.portugueseTitle,
    ].filter(Boolean) as string[];

    return {
      mangaId: work.slug || work.id || mangaKey,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles,
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: mapStatus(work.status),
        author,
        artist,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: thumbnailUrl ? [thumbnailUrl] : [],
        shareUrl: `${BASE_URL}/obra?id=${encodeURIComponent(work.slug || work.id || mangaKey)}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaKey = sourceManga.mangaId.replace(/^[/#]+/, "");
    const url = `${BASE_URL}/api/reader/works/${encodeURIComponent(mangaKey)}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: { referer: `${BASE_URL}/obra?id=${encodeURIComponent(mangaKey)}` },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: OneReaderWorkDetailResponse = JSON.parse(jsonText);
    const chapterList = dto.chapters || [];

    const chapters: Chapter[] = [];
    for (const ch of chapterList) {
      const chapNum = typeof ch.number === "number" ? ch.number : parseFloat(String(ch.number));
      const title = ch.title ? `Capítulo ${ch.number} - ${ch.title}` : `Capítulo ${ch.number}`;

      let publishDate: Date | undefined;
      if (ch.postedAt) {
        const parsed = new Date(ch.postedAt);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: `${mangaKey}#${ch.number}`,
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
    const number = parts[1] ?? String(chapter.chapNum);

    const url = `${BASE_URL}/api/reader/works/${encodeURIComponent(mangaKey)}/chapters/${encodeURIComponent(number)}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/leitor?id=${encodeURIComponent(mangaKey)}&cap=${encodeURIComponent(number)}`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const data: OneReaderChapterDetailResponse = JSON.parse(jsonText);
    const rawPages = data.chapter?.pages ?? [];

    const pages: string[] = [];
    for (const p of rawPages) {
      if (typeof p === "string" && p.trim()) {
        const fullUrl = p.startsWith("http") ? p : `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
        pages.push(sanitizeImageUrl(fullUrl));
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
