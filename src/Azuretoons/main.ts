/* SPDX-License-Identifier: GPL-3.0-or-later */
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
import type {
  AzureChapterDto,
  AzureChapterReadDto,
  AzureObraDto,
  ContentTemplateSearchMetadata,
} from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://azuretoons.com";
const API_URL = "https://azuretoons.com/api";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  let full = url.trim();
  if (full.startsWith("//")) full = "https:" + full;
  else if (!full.startsWith("http://") && !full.startsWith("https://")) {
    full = `${BASE_URL}/${full.replace(/^\//, "")}`;
  }
  try {
    full = decodeURI(full);
  } catch {}
  return encodeURI(full).replace(/%2520/g, "%20").replace(/ /g, "%20");
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

export class AzuretoonsExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
      metadata: { orderBy: "latest", genre: "all", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Lidos",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    _metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    try {
      let url = `${API_URL}/obras?lang=pt`;
      if (section.id === "popular") {
        url = `${API_URL}/obras/ranking?period=all`;
      }

      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const rawText = Application.arrayBufferToUTF8String(buffer);
      let list: AzureObraDto[] = [];
      try {
        const json = JSON.parse(rawText);
        list = Array.isArray(json) ? json : (json.data ?? []);
      } catch {
        list = [];
      }

      const items: DiscoverSectionItem[] = [];
      for (const item of list) {
        if (!item || !item.slug) continue;
        const title = item.title?.trim() || item.slug;
        const mangaId = item.slug;
        const imageUrl =
          cleanCoverUrl(item.coverUrl) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        const latestChap = item.chapters?.[0];
        const chapNum = latestChap?.num ?? latestChap?.chapterNumber;
        const subtitle = chapNum !== undefined ? `Capítulo ${chapNum}` : item.status || undefined;

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle,
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

      return {
        items,
        metadata: undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção AzureToons ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    _metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    try {
      const searchTerm = query.title?.trim() || "";
      const url = searchTerm
        ? `${API_URL}/obras?lang=pt&search=${encodeURIComponent(searchTerm)}`
        : `${API_URL}/obras?lang=pt`;

      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const rawText = Application.arrayBufferToUTF8String(buffer);
      let list: AzureObraDto[] = [];
      try {
        const json = JSON.parse(rawText);
        list = Array.isArray(json) ? json : (json.data ?? []);
      } catch {
        list = [];
      }

      const items: SearchResultItem[] = [];
      for (const item of list) {
        if (!item || !item.slug) continue;
        const title = item.title?.trim() || item.slug;
        const mangaId = item.slug;
        const imageUrl =
          cleanCoverUrl(item.coverUrl) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      return {
        items,
        metadata: undefined,
      };
    } catch (e) {
      console.error("Erro na busca AzureToons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId.replace(/^\/obra\//, "").replace(/^\//, "");
    const url = `${API_URL}/obras/slug/${slug}?lang=pt`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const rawText = Application.arrayBufferToUTF8String(buffer);
    const work: AzureObraDto = JSON.parse(rawText);

    const title = work.title?.trim() || slug;
    const thumbnailUrl =
      cleanCoverUrl(work.coverUrl) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const synopsis = work.synopsis?.trim() || work.description?.trim() || "";

    const rawStatus = (work.status || "").toLowerCase();
    let status = "ongoing";
    if (rawStatus.includes("completo") || rawStatus === "completed" || rawStatus === "end") {
      status = "completed";
    } else if (rawStatus.includes("hiato") || rawStatus === "hiatus") {
      status = "hiatus";
    }

    const tagList: Tag[] = [];
    if (work.genres && Array.isArray(work.genres)) {
      for (const g of work.genres) {
        if (g) {
          tagList.push({ id: sanitizeTagId(g), title: g });
        }
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: work.originalAuthor?.trim() || "AzureToons",
        artist: work.artist?.trim() || work.originalAuthor?.trim() || "AzureToons",
        tagGroups: tagList.length > 0 ? [{ id: "genres", title: "Gêneros", tags: tagList }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: `${BASE_URL}/obra/${slug}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId.replace(/^\/obra\//, "").replace(/^\//, "");
    const url = `${API_URL}/obras/slug/${slug}?lang=pt`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const rawText = Application.arrayBufferToUTF8String(buffer);
    const work: AzureObraDto = JSON.parse(rawText);

    const chaptersList: AzureChapterDto[] = work.chapters ?? [];
    const chapters: Chapter[] = [];

    for (const c of chaptersList) {
      const numRaw = c.num ?? c.chapterNumber ?? 0;
      const num = typeof numRaw === "number" ? numRaw : parseFloat(String(numRaw)) || 0;
      const numStr = String(numRaw);
      const chapterIdentifier = `${slug}/${numStr}`;
      const title =
        c.title && !c.title.startsWith("Capítulo")
          ? `Capítulo ${numStr} - ${c.title}`
          : `Capítulo ${numStr}`;

      const dateStr = c.releaseDate || c.createdAt;
      const publishDate = dateStr ? new Date(dateStr) : undefined;

      chapters.push({
        chapterId: chapterIdentifier,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num,
        title,
        volume: 0,
        publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const parts = chapter.chapterId.split("/");
    const slug = parts[0] || chapter.sourceManga.mangaId;
    const number = parts[1] || String(chapter.chapNum);

    const url = `${API_URL}/chapters/read/${slug}/${number}?lang=pt`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const rawText = Application.arrayBufferToUTF8String(buffer);
    const data: AzureChapterReadDto = JSON.parse(rawText);

    const rawPages = data.images ?? data.pages ?? [];
    const pages: string[] = [];

    for (const p of rawPages) {
      if (!p) continue;
      let pageUrl = p.startsWith("http") ? p : `${BASE_URL}/${p.replace(/^\//, "")}`;
      try {
        pageUrl = decodeURI(pageUrl);
      } catch {}
      pages.push(encodeURI(pageUrl).replace(/%2520/g, "%20").replace(/ /g, "%20"));
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
              containsMoreItems: false,
              type: "singleRowNormal",
            })
          : {
              id: sec.id,
              title: sec.title,
              containsMoreItems: false,
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
      type: DiscoverSectionType.simpleCarousel,
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

export const Azuretoons = new AzuretoonsExtension();
