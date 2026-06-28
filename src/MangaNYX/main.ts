import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
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

const API_BASE = "https://app.manganyx.com/v1/www";

export class MangaNYXExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "highlights",
        title: "Destaques",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: any,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const request = {
      url: `${API_BASE}/home`,
      method: "GET",
    };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);
    const homeData = json.data || {};
    const items: DiscoverSectionItem[] = [];

    if (section.id === "highlights") {
      const list = homeData.freeHighlights || homeData.hero || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        items.push({
          type: "prominentCarouselItem",
          mangaId: manga.slug,
          title: manga.title || "Sem título",
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const list = homeData.recentUpdates || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        const firstCh = manga.recentChapters?.[0];
        const chapterId = firstCh
          ? String(firstCh.id || firstCh.number || "")
          : String(manga.slug);

        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: manga.slug,
          chapterId: chapterId || manga.slug,
          title: manga.title || "Sem título",
          subtitle: firstCh?.number != null ? "Capítulo " + firstCh.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "popular") {
      const list = homeData.popular || homeData.mostRead || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        items.push({
          type: "simpleCarouselItem",
          mangaId: manga.slug,
          title: manga.title || "Sem título",
          subtitle: manga.chapterCount ? `${manga.chapterCount} cap.` : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: any,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const searchTerm = query.title?.trim() || "";
    let url = `${API_BASE}/search?q=${encodeURIComponent(searchTerm)}`;

    if (!searchTerm) {
      url = `${API_BASE}/home`;
    }

    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const items: SearchResultItem[] = [];
    const rawList = !searchTerm ? json.data?.popular || [] : json.data || [];

    for (const manga of rawList) {
      if (!manga?.slug) continue;
      items.push({
        mangaId: manga.slug,
        title: manga.title || "Sem título",
        imageUrl:
          manga.coverUrl ||
          "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(manga.title || "Manga") +
            "&background=random",
        contentRating: ContentRating.EVERYONE,
      });
    }

    return { items, metadata: undefined };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_BASE}/works/${encodeURIComponent(mangaId)}`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);
    const manga = json.data;

    if (!manga) {
      throw new Error(`Falha ao carregar detalhes para o mangá: ${mangaId}`);
    }

    const statusMap: Record<string, string> = {
      published: "ONGOING",
      ongoing: "ONGOING",
      completed: "COMPLETED",
    };

    const genres: Tag[] =
      manga.tags?.map((t: string, idx: number) => ({
        id: String(idx),
        title: String(t),
      })) || [];

    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(manga.title || "Manga") +
      "&background=random";
    const thumbnailUrl = manga.coverUrl || fallbackImage;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: manga.title || "Sem título",
        secondaryTitles: manga.altTitles || [],
        thumbnailUrl,
        synopsis: manga.description || manga.synopsis || "",
        contentRating: manga.isAdult ? ContentRating.MATURE : ContentRating.EVERYONE,
        status: statusMap[manga.status] || statusMap[manga.publicationStatus] || "UNKNOWN",
        author: manga.author || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: manga.coverUrl ? [manga.coverUrl] : [thumbnailUrl],
        shareUrl: `https://manganyx.com/series/${manga.slug || mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${API_BASE}/works/${encodeURIComponent(sourceManga.mangaId)}/chapters?limit=500&page=${page}`;
      const request = { url, method: "GET" };

      const [response, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const json = JSON.parse(data);

      const list = json.data || [];
      if (json.meta?.totalPages) {
        totalPages = json.meta.totalPages;
      }

      for (const ch of list) {
        if (!ch) continue;
        const num = ch.number != null ? ch.number : 0;
        chapters.push({
          chapterId: ch.id ? String(ch.id) : String(num),
          sourceManga,
          title: ch.title ? `${ch.title}` : `Capítulo ${num}`,
          chapNum: Number(num) || 0,
          publishDate: ch.publishedAt ? new Date(ch.publishedAt) : undefined,
          langCode: "PT-BR",
          volume: 0,
        });
      }

      page++;
    } while (page <= totalPages);

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${API_BASE}/works/${encodeURIComponent(chapter.sourceManga.mangaId)}/chapters/${encodeURIComponent(chapter.chapterId)}/pages`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const rawPages = json.data?.pages || [];
    rawPages.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

    const pages: string[] = [];
    for (const p of rawPages) {
      if (p.imageUrl) pages.push(p.imageUrl);
      else if (p.url) pages.push(p.url);
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const MangaNYX = new MangaNYXExtension();
