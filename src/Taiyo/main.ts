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
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  TaiyoMultiSearchResponse,
  TaiyoSearchHit,
  TaiyoSearchMetadata,
  TaiyoTitleItem,
  TaiyoTrpcChapter,
  TaiyoTrpcResponse,
} from "./models";
import { MainInterceptor } from "./network";
import type TaiyoConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://taiyo.moe";
const MEILISEARCH_URL = "https://meilisearch.taiyo.moe/multi-search";
const DEFAULT_BEARER_TOKEN = "48aa86f73de09a7705a2938a1a35e5a12cff6519695fcad395161315182286e5";
const IMG_CDN = "https://cdn.taiyo.moe/medias";

function pickBestTitle(titles: TaiyoTitleItem[] | undefined): string {
  if (!titles || titles.length === 0) return "Obra";
  const pt = titles.find((t) => t.language.includes("pt"));
  if (pt?.title) return pt.title;
  const en = titles.find((t) => t.language.includes("en"));
  if (en?.title) return en.title;
  const main = titles.find((t) => t.isMainTitle);
  if (main?.title) return main.title;
  const sorted = [...titles].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return sorted[0]?.title ?? "Obra";
}

function buildCoverUrl(mediaId: string, coverId?: string): string {
  if (!coverId) return "";
  return `${IMG_CDN}/${mediaId}/covers/${coverId}.jpg`;
}

export class TaiyoExtension implements ExtensionImpl<typeof TaiyoConfig> {
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

  private bearerToken = DEFAULT_BEARER_TOKEN;

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
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const limit = 21;
    const offset = limit * (page - 1);

    const sortRule = section.id === "updates" ? ["updatedAt:desc"] : undefined;

    const requestBody: any = {
      queries: [
        {
          indexUid: "medias",
          q: "",
          filter: ["deletedAt IS NULL"],
          limit,
          offset,
          ...(sortRule ? { sort: sortRule } : {}),
        },
      ],
    };

    const request = {
      url: MEILISEARCH_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.bearerToken}`,
      },
      body: JSON.stringify(requestBody),
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const res: TaiyoMultiSearchResponse = JSON.parse(data);
    const hits: TaiyoSearchHit[] = res.results?.[0]?.hits ?? [];

    const items: DiscoverSectionItem[] = hits.map((hit) => {
      const title = pickBestTitle(hit.titles);
      const cover = buildCoverUrl(hit.id, hit.mainCoverId || hit.coverId);
      const imageUrl =
        cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

      if (section.id === "popular") {
        return {
          mangaId: hit.id,
          title,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        };
      }

      return {
        mangaId: hit.id,
        chapterId: hit.id,
        title,
        imageUrl,
        type: "chapterUpdatesCarouselItem",
        contentRating: ContentRating.EVERYONE,
      };
    });

    const hasNext = hits.length >= limit;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { type: "all", status: "all", genre: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<TaiyoSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const limit = 21;
    const offset = limit * (page - 1);
    const title = query.title?.trim() ?? "";

    const filters: string[] = ["deletedAt IS NULL"];
    if (query.metadata?.type && query.metadata.type !== "all") {
      filters.push(`type = "${query.metadata.type}"`);
    }
    if (query.metadata?.status && query.metadata.status !== "all") {
      filters.push(`status = "${query.metadata.status}"`);
    }
    if (query.metadata?.genre && query.metadata.genre !== "all") {
      filters.push(`genres = "${query.metadata.genre}"`);
    }

    const requestBody = {
      queries: [
        {
          indexUid: "medias",
          q: title,
          filter: filters,
          limit,
          offset,
        },
      ],
    };

    const request = {
      url: MEILISEARCH_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.bearerToken}`,
      },
      body: JSON.stringify(requestBody),
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const res: TaiyoMultiSearchResponse = JSON.parse(data);
    const hits: TaiyoSearchHit[] = res.results?.[0]?.hits ?? [];

    const items: SearchResultItem[] = hits.map((hit) => {
      const mangaTitle = pickBestTitle(hit.titles);
      const cover = buildCoverUrl(hit.id, hit.mainCoverId || hit.coverId);
      return {
        mangaId: hit.id,
        title: mangaTitle,
        imageUrl:
          cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(mangaTitle)}&background=random`,
        contentRating: ContentRating.EVERYONE,
      };
    });

    const hasNext = hits.length >= limit;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const pageUrl = `${BASE_URL}/media/${mangaId}`;
    const request = { url: pageUrl, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    let title = $("p.media-title, h1").first().text().trim();
    let synopsis = $("section > div.flex + div p, .media-synopsis, p.synopsis")
      .first()
      .text()
      .trim();

    let image = "";
    const imgEl = $("section:has(h2) img, .media-cover img, img[src*='covers']").first();
    const srcset = imgEl.attr("srcset");
    if (srcset) {
      image = srcset.split(",")[0]?.trim()?.split(" ")[0]?.trim() || "";
    }
    if (!image) {
      image = imgEl.attr("src") || "";
    }
    if (image.startsWith("/")) {
      image = `${BASE_URL}${image}`;
    }

    if (!title) {
      try {
        const srchReq = {
          url: MEILISEARCH_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.bearerToken}`,
          },
          body: JSON.stringify({
            queries: [
              {
                indexUid: "medias",
                filter: [`id = "${mangaId}"`],
                limit: 1,
              },
            ],
          }),
        };
        const [__, sBuf] = await Application.scheduleRequest(srchReq);
        const sData: TaiyoMultiSearchResponse = JSON.parse(
          Application.arrayBufferToUTF8String(sBuf),
        );
        const hit = sData.results?.[0]?.hits?.[0];
        if (hit) {
          title = pickBestTitle(hit.titles);
          if (!synopsis) synopsis = hit.synopsis || "";
          if (!image) image = buildCoverUrl(hit.id, hit.mainCoverId || hit.coverId);
        }
      } catch (err) {
        console.error("Erro ao buscar detalhes de fallback no Meilisearch:", err);
      }
    }

    if (!title) title = "Obra";
    const thumbnailUrl =
      image || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $("a[href*='/genre/'], a[href*='/genres/'], span.badge").each((_, el) => {
      const g = $(el).text().trim();
      if (g && !seenGenres.has(g.toLowerCase())) {
        seenGenres.add(g.toLowerCase());
        genres.push({
          id: g.toLowerCase().replace(/\s+/g, "-"),
          title: g,
        });
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: synopsis || "",
        contentRating: ContentRating.EVERYONE,
        status: "ongoing",
        author: "Desconhecido",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: pageUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 10) {
      const input = JSON.stringify({
        "0": {
          json: {
            mediaId: sourceManga.mangaId,
            page,
            perPage: 50,
          },
        },
      });

      const url = `${BASE_URL}/api/trpc/chapters.getByMediaId?batch=1&input=${encodeURIComponent(input)}`;
      const request = { url, method: "GET" };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const parsedList: TaiyoTrpcResponse[] = JSON.parse(data);

      const chapterData = parsedList[0]?.result?.data?.json;
      const chList: TaiyoTrpcChapter[] = chapterData?.chapters ?? [];
      totalPages = chapterData?.totalPages ?? 1;

      for (const c of chList) {
        const title = c.title ? `Capítulo ${c.number} - ${c.title}` : `Capítulo ${c.number}`;
        const publishDate = c.createdAt ? new Date(c.createdAt) : undefined;

        chapters.push({
          chapterId: c.id,
          sourceManga,
          langCode: "PT-BR",
          chapNum: c.number,
          title,
          volume: c.volume ?? 0,
          publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
        });
      }

      page++;
    }

    return chapters.sort((a, b) => b.chapNum - a.chapNum);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const rawId = chapter.chapterId.replace(/^\/chapter\//, "").replace(/\/.*$/, "");
    const chapterUrl = `${BASE_URL}/chapter/${rawId}/1`;

    const request = { url: chapterUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const html = Application.arrayBufferToUTF8String(buffer);

    const mediaMatch = html.match(/\\"media\\":\{\\"id\\":\\"([^\\"]+)\\"/);
    const mediaId = mediaMatch?.[1] || chapter.sourceManga.mangaId;

    const pageIdRegex =
      /\{\\"id\\":\\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\"\}/g;
    const pages: string[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = pageIdRegex.exec(html)) !== null) {
      const pageId = match[1];
      if (pageId && !seen.has(pageId) && pageId !== rawId && pageId !== mediaId) {
        seen.add(pageId);
        pages.push(`${IMG_CDN}/${mediaId}/chapters/${rawId}/${pageId}.jpg`);
      }
    }

    if (pages.length === 0) {
      const $ = cheerio.load(html);
      $("img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src.includes("chapters") && !seen.has(src)) {
          seen.add(src);
          pages.push(src);
        }
      });
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

export const Taiyo = new TaiyoExtension();
