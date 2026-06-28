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
import type * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";
const BASE_URL = "https://hipertoon.com";

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src =
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    $img.attr("srcset")?.split(" ")[0] ||
    $img.attr("src") ||
    $img.attr("data-cfsrc") ||
    "";
  src = src.trim().replace(/-\d+x\d+/g, "");
  return src.startsWith("/") ? BASE_URL + src : src;
}

export class HipertoonExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "updates",
        title: "Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "new",
        title: "Recém Adicionados",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: any,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const url =
      "https://hipertoon.com/api/trpc/auth.me,recommendations.trending,recommendations.latestChapters,recommendations.newlyAdded?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%2C%221%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%222%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%223%22%3A%7B%22json%22%3A%7B%22limit%22%3A10%7D%7D%7D";

    const request = {
      url,
      method: "GET",
    };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      const trending = json[1]?.result?.data?.json || [];
      for (const manga of trending) {
        items.push({
          type: "simpleCarouselItem",
          mangaId: `${manga.id}:${manga.slug}`,
          title: manga.title,
          subtitle: manga.latestChapter ? "Capítulo " + manga.latestChapter.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const latest = json[2]?.result?.data?.json || [];
      for (const manga of latest) {
        const firstCh = manga.chapters?.[0];
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: `${manga.seriesId}:${manga.seriesSlug}`,
          chapterId: firstCh && firstCh.number != null ? String(firstCh.number) : String(manga.seriesSlug || manga.seriesId || "unknown"),
          title: manga.seriesTitle || "Sem título",
          subtitle: firstCh && firstCh.number != null ? "Capítulo " + firstCh.number : undefined,
          imageUrl:
            manga.seriesCoverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.seriesTitle) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "new") {
      const newlyAdded = json[3]?.result?.data?.json || [];
      for (const manga of newlyAdded) {
        items.push({
          type: "prominentCarouselItem",
          mangaId: `${manga.id}:${manga.slug}`,
          title: manga.title,
          subtitle: manga.latestChapter ? "Capítulo " + manga.latestChapter.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title) +
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
    metadata?: number,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 0;
    const limit = 30;
    const offset = page * limit;

    const input = {
      "0": {
        json: {
          q: query.title || "",
          sort: "relevance",
          filters: {
            genres: null,
            type: null,
            status: null,
            contentRating: null,
          },
          limit: limit,
          offset: offset,
        },
        meta: {
          values: {
            "filters.genres": ["undefined"],
            "filters.type": ["undefined"],
            "filters.status": ["undefined"],
            "filters.contentRating": ["undefined"],
          },
        },
      },
    };

    const searchUrl = `https://hipertoon.com/api/trpc/search.query?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
    const request = { url: searchUrl, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const hits = json[0]?.result?.data?.json?.hits || [];
    const items: SearchResultItem[] = [];

    for (const manga of hits) {
      items.push({
        mangaId: `${manga.id}:${manga.slug}`,
        title: manga.title,
        imageUrl:
          manga.coverUrl ||
          "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(manga.title) +
            "&background=random",
        contentRating: ContentRating.EVERYONE,
      });
    }

    return {
      items,
      metadata: hits.length === limit ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const [id, slug] = mangaId.split(":");
    const actualSlug = slug || mangaId;

    const url = `https://hipertoon.com/api/trpc/series.bySlugWithGenres?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { slug: actualSlug } } }))}`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const manga = json[0]?.result?.data?.json;
    if (!manga) throw new Error("Failed to parse Manga Details from Hipertoon API");

    const statusMap: any = {
      releasing: "ONGOING",
      completed: "COMPLETED",
      ongoing: "ONGOING",
    };

    const genres: Tag[] =
      manga.genres
        ?.filter((g: any) => g && g.id != null && g.name != null)
        .map((g: any) => ({ id: String(g.id), title: String(g.name) })) || [];

    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(manga.title || "Manga") +
      "&background=random";
    const thumbnailUrl = manga.coverUrl || fallbackImage;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: manga.title || "Sem título",
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: manga.synopsis || "",
        contentRating: ContentRating.EVERYONE,
        status: statusMap[manga.status] || "UNKNOWN",
        author: manga.authors?.[0] || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Genres", tags: genres }],
        artworkUrls: manga.coverUrl ? [manga.coverUrl] : [thumbnailUrl],
        shareUrl: `https://hipertoon.com/manga/${actualSlug}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const [id, slug] = sourceManga.mangaId.split(":");
    const seriesId = id;

    if (!seriesId) throw new Error("Invalid mangaId format, missing seriesId");

    const url = `https://hipertoon.com/api/trpc/series.chapters?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { seriesId: parseInt(seriesId) } } }))}`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const chaptersData = json[0]?.result?.data?.json || [];
    const chapters: Chapter[] = [];

    for (const ch of chaptersData) {
      if (!ch) continue;
      const num = ch.number != null ? ch.number : 0;
      chapters.push({
        chapterId: ch.id != null ? String(ch.id) : String(num),
        sourceManga,
        title: ch.title || "Capítulo " + num,
        chapNum: Number(num) || 0,
        langCode: "PT-BR",
        volume: 0,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const [id, slug] = chapter.sourceManga.mangaId.split(":");
    const actualSlug = slug || chapter.sourceManga.mangaId;

    const url = `https://hipertoon.com/api/trpc/reader.chapterPages?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { seriesSlug: actualSlug, chapterNumber: parseFloat(chapter.chapterId) } } }))}`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = JSON.parse(data);

    const pagesData = json[0]?.result?.data?.json || [];
    const pages: string[] = [];

    for (const page of pagesData) {
      if (page.webpUrl) pages.push(page.webpUrl);
      else if (page.avifUrl) pages.push(page.avifUrl);
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}
export const Hipertoon = new HipertoonExtension();
