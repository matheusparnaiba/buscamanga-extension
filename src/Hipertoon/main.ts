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
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

const BASE_URL = "https://hipertoon.com";

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
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/page/${page}/`;
    
    const request = {
      url,
      method: "GET",
    };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    $(".es-upd-card").each((_, el) => {
      const title = $(el).find(".es-upd-title").text().trim();
      const href = $(el).find(".es-upd-title").attr("href");
      const img = $(el).find(".es-upd-cover img").attr("src")?.trim() ?? "";
      
      if (href) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;
        
        items.push({
          mangaId,
          title,
          imageUrl: img,
          type: "simpleCarouselItem",
        });
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(
    query: SearchQuery<ContentTemplateSearchMetadata>,
  ): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title)}&post_type=wp-manga`;
    
    const request = { url: searchUrl, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".c-tabs-item__content").each((_, el) => {
      const titleElement = $(el).find(".post-title h3 a");
      const title = titleElement.text().trim();
      const href = titleElement.attr("href");
      const img = $(el).find(".tab-thumb a img").attr("src")?.trim() ?? "";

      if (href) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;
        
        items.push({
          mangaId,
          title,
          imageUrl: img,
        });
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}/`;
    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title = $(".post-title h1").text().trim();
    const image = $(".summary_image a img").attr("src")?.trim() ?? "";
    const synopsis = $(".description-summary .summary__content").text().trim();
    const author = $(".author-content a").text().trim();
    const statusText = $(".post-status .post-content_item .summary-content").last().text().trim().toLowerCase();
    
    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) status = "COMPLETED";

    const genres: Tag[] = [];
    $(".genres-content a").each((_, el) => {
      const g = $(el).text().trim();
      genres.push({ id: g, title: g });
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: image,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Genres", tags: genres }],
        artworkUrls: [image],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/`;
    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    let $ = cheerio.load(data);
    const chapters: Chapter[] = [];

    const mangaIdAttr = $("#manga-chapters-holder").attr("data-id");
    if (mangaIdAttr) {
      const ajaxReq = {
        url: `${BASE_URL}/wp-admin/admin-ajax.php`,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `action=manga_get_chapters&manga=${mangaIdAttr}`
      };
      const [ajaxResp, ajaxBuffer] = await Application.scheduleRequest(ajaxReq);
      const ajaxData = Application.arrayBufferToUTF8String(ajaxBuffer);
      $ = cheerio.load(ajaxData);
    }

    $(".wp-manga-chapter").each((_, el) => {
      const a = $(el).find("a");
      const href = a.attr("href")?.trim() ?? "";
      const name = a.text().trim();
      const numMatch = name.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

      chapters.push({
        chapterId: href,
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title: name,
        volume: 0,
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = chapter.chapterId;
    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    $(".reading-content img").each((_, el) => {
      const src = $(el).attr("src")?.trim() ?? $(el).attr("data-src")?.trim();
      if (src) pages.push(src);
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const Hipertoon = new HipertoonExtension();
