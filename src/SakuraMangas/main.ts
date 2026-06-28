import {
  BasicRateLimiter,
  CookieStorageInterceptor,
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
  type Cookie,
  type Request,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

const BASE_URL = "https://sakuramangas.org";

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

export class SakuraMangasExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 5,
    ignoreImages: true,
  });

  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "stateManager",
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    for (const cookie of cookies) {
      this.cookieStorageInterceptor.setCookie(cookie);
    }
  }

  async cloudflareBypassCompleted(
    request: Request,
    cookies: Cookie[],
    localStorage: Record<string, string>,
  ): Promise<void> {
    for (const cookie of cookies) {
      this.cookieStorageInterceptor.setCookie(cookie);
    }
    let ua: string | undefined = undefined;
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (key.toLowerCase() === "user-agent") {
          ua = request.headers[key];
          break;
        }
      }
    }
    if (ua && typeof ua === "string") {
      Application.setState(ua, "cf_user_agent");
    }
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
        id: "projects",
        title: "Projetos em Destaque",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = page > 1 ? `${BASE_URL}/page/${page}/` : `${BASE_URL}/`;

    if ((section.id === "popular" || section.id === "projects") && page > 1) {
      return { items: [], metadata: undefined };
    }

    const request = {
      url,
      method: "GET",
    };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      let populars = $(
        ".rank-card-universal, .popular-statuses .widget-content .popular-item-wrap, .widget-content .popular-item-wrap, .popular-item-wrap, .popular-manga, .manga-slider .slider__item",
      );
      if (populars.length === 0) populars = $(".sidebar .popular-item-wrap");
      if (populars.length === 0) populars = $(".page-item-detail, .manga-item, .added-card").slice(0, 15);

      populars.each((_, el) => {
        const titleEl = $(el)
          .find(".rank-manga-title, .widget-title a, h5 a, h3 a, h4 a, .post-title a, .manga-title a")
          .first();
        const title =
          titleEl.text().trim() ||
          $(el).find(".rank-manga-title").text().trim() ||
          $(el).find("a").first().attr("title") ||
          $(el).find("a").first().text().trim() ||
          "";
        const href = $(el).attr("href") || titleEl.attr("href") || $(el).find("a").first().attr("href");
        const img = getImageSrc($(el).find("img.rank-thumb-img, img"));
        const subtitle = $(el).find(".list-chapter .chapter-item .chapter a").first().text().trim();

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          let safeImg = img;
          if (safeImg && safeImg.startsWith("http")) {
            safeImg = safeImg.includes("?") ? safeImg + "&v=4" : safeImg + "?v=4";
          } else {
            safeImg =
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title) +
              "&background=random";
          }

          items.push({
            mangaId,
            title,
            subtitle: subtitle || undefined,
            imageUrl: safeImg,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      $(".updates-column, .update-info-box, .manga-update-card, .added-card, .manga-item, .page-item-detail, .c-tabs-item__content, .item-summary").each((_, el) => {
        const titleEl = $(el).find(".update-title, .added-title, .manga-title a, h3 a, h4 a, .post-title a").first();
        const title =
          titleEl.text().trim() ||
          $(el).find(".update-title, .added-title").text().trim() ||
          $(el).find("a").first().attr("title") ||
          $(el).find("a").first().text().trim() ||
          "";
        const href = $(el).attr("href") || titleEl.attr("href") || $(el).find("a.update-thumb-box, a.added-card, a").first().attr("href");
        const img = getImageSrc($(el).find("img.update-thumb, img.added-thumb, img"));
        const chapterEl = $(el)
          .find(".chapter-list .chapter-button, .chapter-item .chapter a, .list-chapter a")
          .first();
        const chapterSubtitle = chapterEl.text().trim() || "Recente";
        const chapterHref = chapterEl.attr("href") || href || "unknown";

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          let safeImg = img;
          if (safeImg && safeImg.startsWith("http")) {
            safeImg = safeImg.includes("?") ? safeImg + "&v=4" : safeImg + "?v=4";
          } else {
            safeImg =
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title) +
              "&background=random";
          }

          items.push({
            mangaId,
            chapterId: chapterHref,
            title,
            subtitle: chapterSubtitle || undefined,
            imageUrl: safeImg,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });
      return {
        items,
        metadata: items.length > 0 ? page + 1 : undefined,
      };
    }

    if (section.id === "projects") {
      let sliders = $(".hero-poster-col, .hero-poster-box, .manga-slider .slider__item, .slider__content, .popular-item-wrap");
      if (sliders.length === 0) sliders = $(".page-item-detail, .manga-item, .added-card").slice(0, 15);

      sliders.each((_, el) => {
        const titleEl = $(el).find(".hero-title, .post-title a, h3 a, h4 a, h5 a, .manga-title a").first();
        const title =
          titleEl.text().trim() ||
          $(el).find(".hero-title").text().trim() ||
          $(el).find("a").first().attr("title") ||
          $(el).find("a").first().text().trim() ||
          "";
        const href = $(el).attr("href") || titleEl.attr("href") || $(el).find("a.hero-poster-box, a").first().attr("href");
        const img = getImageSrc($(el).find("img.hero-poster-img, img"));

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;
          items.push({
            mangaId,
            title,
            imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });
      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
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
    const searchTerm = query.title ?? "";
    const searchUrl =
      page > 1
        ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`
        : `${BASE_URL}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;

    const request = { url: searchUrl, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".c-tabs-item__content, .page-item-detail, .manga-item, .added-card, .rank-card-universal, .update-info-box").each((_, el) => {
      const titleElement = $(el).find(".added-title, .rank-manga-title, .update-title, .post-title a, h3 a, h4 a, .manga-title a").first();
      const title =
        titleElement.text().trim() ||
        $(el).find(".added-title, .rank-manga-title, .update-title").text().trim() ||
        $(el).find("a").first().attr("title") ||
        $(el).find("a").first().text().trim() ||
        "";
      const href = $(el).attr("href") || titleElement.attr("href") || $(el).find("a").first().attr("href");
      const img = getImageSrc($(el).find(".tab-thumb a img, img.added-thumb, img.rank-thumb-img, img.update-thumb, img"));

      if (href && title) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        items.push({
          mangaId,
          title,
          imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
          contentRating: ContentRating.EVERYONE,
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

    const title = $(".post-title h1, .manga-title h1, h1.entry-title, .manga-info h1").text().trim() || "Sem título";
    const rawImage = getImageSrc($(".summary_image img, .manga-thumb img, .thumb img"));
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage = "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(".description-summary .summary__content, .summary_content, .manga-excerpt, .entry-content p").text().trim();
    const author = $(".author-content a").text().trim() || "Desconhecido";
    const statusText = $(".post-status .post-content_item .summary-content")
      .last()
      .text()
      .trim()
      .toLowerCase();

    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) status = "COMPLETED";

    const genres: Tag[] = [];
    $(".genres-content a").each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push({ id: encodeURI(g), title: g });
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Genres", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/ajax/chapters/`;
    const request = {
      url,
      method: "POST",
    };
    let [response, buffer] = await Application.scheduleRequest(request);
    let data = Application.arrayBufferToUTF8String(buffer);
    let $ = cheerio.load(data);
    const chapters: Chapter[] = [];

    $(".wp-manga-chapter, .chapter-item").each((_, el) => {
      const a = $(el).find("a");
      const href = a.attr("href")?.trim() ?? "";
      const name = a.text().trim();
      if (!href) return;
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

    if (chapters.length === 0) {
      const getUrl = `${BASE_URL}/manga/${sourceManga.mangaId}/`;
      const getReq = { url: getUrl, method: "GET" };
      [response, buffer] = await Application.scheduleRequest(getReq);
      data = Application.arrayBufferToUTF8String(buffer);
      $ = cheerio.load(data);

      $(".wp-manga-chapter, .chapter-item, li.chapter").each((_, el) => {
        const a = $(el).find("a");
        const href = a.attr("href")?.trim() ?? "";
        const name = a.text().trim();
        if (!href) return;
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
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = chapter.chapterId;
    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    $(".page-break img, .reading-content img, .chapter-content img, .entry-content img, #readerarea img, .container-chapter-reader img").each((_, el) => {
      const src = getImageSrc($(el));
      if (src) pages.push(src);
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}
export const SakuraMangas = new SakuraMangasExtension();
