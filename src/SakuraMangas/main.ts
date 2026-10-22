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
  type Response,
  CloudflareError,
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
    $img.attr("data-bg") ||
    "";
  src = src.trim().replace(/-\d+x\d+/g, "");
  if (!src) return "";
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/")) return BASE_URL + src;
  return src;
}

export class SakuraMangasExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 5,
    ignoreImages: true,
  });

  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "memory",
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.mainInterceptor.registerInterceptor();

    const saved = Application.getState("sakura_saved_cookies") as
      | Array<{ name: string; value: string; domain?: string; path?: string }>
      | undefined;
    if (Array.isArray(saved)) {
      for (const c of saved) {
        if (c?.name && c?.value) {
          try {
            this.cookieStorageInterceptor.setCookie({
              name: c.name,
              value: c.value,
              domain: c.domain || "sakuramangas.org",
              path: c.path || "/",
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            });
          } catch {
            // Ignore any CookieStorageInterceptor issues
          }
        }
      }
    }
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    await this.handleCloudflareBypass(cookies);
  }

  async cloudflareBypassCompleted(
    request: Request,
    cookies: Cookie[],
    _localStorage: Record<string, string>,
  ): Promise<void> {
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
    await this.handleCloudflareBypass(cookies);
  }

  private async handleCloudflareBypass(cookies: Cookie[]): Promise<void> {
    if (!cookies || !Array.isArray(cookies)) return;

    const cleanCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
    const headerParts: string[] = [];

    for (const c of cookies) {
      if (!c || !c.name || !c.value) continue;
      const domain = c.domain ? c.domain.replace(/^https?:\/\//, "") : "sakuramangas.org";
      const path = c.path || "/";

      cleanCookies.push({
        name: c.name,
        value: c.value,
        domain,
        path,
      });

      headerParts.push(`${c.name}=${c.value}`);

      try {
        this.cookieStorageInterceptor.setCookie({
          name: c.name,
          value: c.value,
          domain,
          path,
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      } catch {
        // Ignore any CookieStorageInterceptor issues
      }
    }

    if (cleanCookies.length > 0) {
      Application.setState(cleanCookies, "sakura_saved_cookies");
      Application.setState(headerParts.join("; "), "sakura_cookie_header");
    }
  }

  private async getCloudflareResolutionRequest(): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    return {
      url: `${BASE_URL}/`,
      method: "GET",
      headers: {
        "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
        referer: `${BASE_URL}/`,
      },
    };
  }

  private async checkCloudflare(response: Response, data: string): Promise<void> {
    if (
      response.status === 403 ||
      response.status === 503 ||
      data.includes("Just a moment...") ||
      data.includes("_cf_chl_opt") ||
      data.includes("challenges.cloudflare.com")
    ) {
      const resolutionRequest = await this.getCloudflareResolutionRequest();
      throw new CloudflareError(
        resolutionRequest,
        "Proteção Cloudflare ativa no Sakura Mangas! Toque para resolver.",
      );
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
    metadata: any,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    let page = 1;
    if (typeof metadata === "number" && metadata > 0) {
      page = metadata;
    } else if (metadata && typeof metadata === "object" && metadata.page) {
      page = Number(metadata.page) || 1;
    } else if (typeof metadata === "string") {
      page = Number(metadata) || 1;
    }

    if ((section.id === "popular" || section.id === "projects") && page > 1) {
      return { items: [], metadata: undefined };
    }

    let url = `${BASE_URL}/`;
    if (section.id === "popular") {
      url = `${BASE_URL}/`;
    } else if (section.id === "updates") {
      url = page > 1 ? `${BASE_URL}/obras/page/${page}/?m_orderby=latest` : `${BASE_URL}/`;
    }

    const request: Request = { url, method: "GET" };
    let [response, buffer] = await Application.scheduleRequest(request);
    let data = Application.arrayBufferToUTF8String(buffer);

    await this.checkCloudflare(response, data);

    let $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      const parsePopular = ($doc: cheerio.CheerioAPI): void => {
        let popularElements = $doc(
          ".rank-card-universal, .popular-statuses .widget-content .popular-item-wrap, .widget-content .popular-item-wrap, .popular-item-wrap, .popular-manga, .manga-slider .slider__item, .page-item-detail, .manga-item, .added-card, .badge-pos-1, article.badge-pos-1",
        );
        if (popularElements.length === 0) popularElements = $doc(".sidebar .popular-item-wrap");

        popularElements.each((_, el) => {
          const titleEl = $doc(el)
            .find(
              ".rank-manga-title, .widget-title a, h5 a, h3 a, h4 a, .post-title a, .manga-title a, h3, h4, h5",
            )
            .first();
          const title =
            titleEl.text().trim() ||
            $doc(el).find(".rank-manga-title").text().trim() ||
            $doc(el).find("a").first().attr("title") ||
            $doc(el).find("a").first().text().trim() ||
            "";
          const href =
            $doc(el)
              .find(".post-title a, h3 a, h4 a, h5 a, .manga-title a, a")
              .first()
              .attr("href") ||
            $doc(el).attr("href") ||
            titleEl.attr("href");
          const img = getImageSrc(
            $doc(el).find("img.rank-thumb-img, .tab-thumb img, .item-thumb img, img"),
          );
          const subtitle = $doc(el)
            .find(".list-chapter .chapter-item .chapter a, .chapter a, .chapter-name")
            .first()
            .text()
            .trim();

          if (href && title) {
            const idMatch = href.match(/\/(?:manga|obras|series)\/([^/]+)/);
            const mangaId = idMatch
              ? (idMatch[1] as string)
              : href.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");

            let safeImg = img;
            if (!safeImg || !safeImg.startsWith("http")) {
              safeImg =
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random";
            }

            if (!items.some((it) => (it as any).mangaId === mangaId)) {
              items.push({
                mangaId,
                title,
                subtitle: subtitle || undefined,
                imageUrl: safeImg,
                type: "simpleCarouselItem",
                contentRating: ContentRating.EVERYONE,
              });
            }
          }
        });
      };

      parsePopular($);

      // Fallback: If 0 items found on homepage, try /obras/?m_orderby=views
      if (items.length === 0) {
        try {
          const fallbackReq: Request = { url: `${BASE_URL}/obras/?m_orderby=views`, method: "GET" };
          const [fRes, fBuf] = await Application.scheduleRequest(fallbackReq);
          const fData = Application.arrayBufferToUTF8String(fBuf);
          await this.checkCloudflare(fRes, fData);
          const $fallback = cheerio.load(fData);
          parsePopular($fallback);
        } catch (e) {
          if (e instanceof CloudflareError) throw e;
        }
      }

      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const parseUpdates = ($doc: cheerio.CheerioAPI): void => {
        $doc(
          ".updates-column, .update-info-box, .manga-update-card, .added-card, .manga-item, .page-item-detail, .c-tabs-item__content, .item-summary, .badge-pos-1, article.badge-pos-1, .col-6.col-md-3, .col-6.col-md-2, .listupd .bs, .bsx",
        ).each((_, el) => {
          const titleEl = $doc(el)
            .find(".update-title, .added-title, .manga-title a, h3 a, h4 a, .post-title a, h3, h4")
            .first();
          const title =
            titleEl.text().trim() ||
            $doc(el).find(".update-title, .added-title").text().trim() ||
            $doc(el).find("a").first().attr("title") ||
            $doc(el).find("a").first().text().trim() ||
            "";
          const href =
            $doc(el)
              .find("a.update-thumb-box, a.added-card, .post-title a, h3 a, h4 a, a")
              .first()
              .attr("href") ||
            $doc(el).attr("href") ||
            titleEl.attr("href");
          const img = getImageSrc(
            $doc(el).find(
              "img.update-thumb, img.added-thumb, .tab-thumb img, .item-thumb img, img",
            ),
          );
          const chapterEl = $doc(el)
            .find(
              ".chapter-list .chapter-button, .chapter-item .chapter a, .list-chapter a, .chapter a, .chapter-name",
            )
            .first();
          const chapterSubtitle = chapterEl.text().trim() || "Recente";
          const chapterHref = chapterEl.attr("href") || href || "unknown";

          if (href && title) {
            const idMatch = href.match(/\/(?:manga|obras|series)\/([^/]+)/);
            const mangaId = idMatch
              ? (idMatch[1] as string)
              : href.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");

            let safeImg = img;
            if (!safeImg || !safeImg.startsWith("http")) {
              safeImg =
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random";
            }

            if (!items.some((it) => (it as any).mangaId === mangaId)) {
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
          }
        });
      };

      parseUpdates($);

      // Fallback: If 0 items found on page 1 homepage, try /obras/?m_orderby=latest
      if (items.length === 0 && page === 1) {
        try {
          const fallbackReq: Request = {
            url: `${BASE_URL}/obras/?m_orderby=latest`,
            method: "GET",
          };
          const [fRes, fBuf] = await Application.scheduleRequest(fallbackReq);
          const fData = Application.arrayBufferToUTF8String(fBuf);
          await this.checkCloudflare(fRes, fData);
          const $fallback = cheerio.load(fData);
          parseUpdates($fallback);
        } catch (e) {
          if (e instanceof CloudflareError) throw e;
        }
      }

      return {
        items,
        metadata: items.length > 0 ? page + 1 : undefined,
      };
    }

    if (section.id === "projects") {
      let sliders = $(
        ".swiper-slide, .hero-poster-col, .hero-poster-box, .manga-slider .slider__item, .slider__content, .popular-item-wrap, .page-item-detail, .manga-item, .added-card",
      );

      sliders.each((_, el) => {
        const titleEl = $(el)
          .find(".hero-title, .post-title a, h3 a, h4 a, h5 a, .manga-title a, h3, h4")
          .first();
        const title =
          titleEl.text().trim() ||
          $(el).find(".hero-title").text().trim() ||
          $(el).find("a").first().attr("title") ||
          $(el).find("a").first().text().trim() ||
          "";
        const href =
          $(el)
            .find("a.hero-poster-box, .post-title a, h3 a, h4 a, h5 a, a")
            .first()
            .attr("href") ||
          $(el).attr("href") ||
          titleEl.attr("href");
        const img = getImageSrc(
          $(el).find("img.hero-poster-img, .tab-thumb img, .item-thumb img, img"),
        );

        if (href && title) {
          const idMatch = href.match(/\/(?:manga|obras|series)\/([^/]+)/);
          const mangaId = idMatch
            ? (idMatch[1] as string)
            : href.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");

          if (!items.some((it) => (it as any).mangaId === mangaId)) {
            items.push({
              mangaId,
              title,
              imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
              type: "prominentCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
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
    _sortingOption?: SortingOption,
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

    await this.checkCloudflare(response, data);

    let $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    const parseResults = ($doc: cheerio.CheerioAPI): void => {
      $doc(
        ".c-tabs-item__content, .page-item-detail, .manga-item, .added-card, .rank-card-universal, .update-info-box, .badge-pos-1, article.badge-pos-1, .col-6.col-md-3",
      ).each((_, el) => {
        const titleElement = $doc(el)
          .find(
            ".added-title, .rank-manga-title, .update-title, .post-title a, h3 a, h4 a, .manga-title a, h3, h4",
          )
          .first();
        const title =
          titleElement.text().trim() ||
          $doc(el).find(".added-title, .rank-manga-title, .update-title").text().trim() ||
          $doc(el).find("a").first().attr("title") ||
          $doc(el).find("a").first().text().trim() ||
          "";
        const href =
          $doc(el).find(".post-title a, h3 a, h4 a, a").first().attr("href") ||
          $doc(el).attr("href") ||
          titleElement.attr("href");
        const img = getImageSrc(
          $doc(el).find(
            ".tab-thumb a img, img.added-thumb, img.rank-thumb-img, img.update-thumb, .item-thumb img, img",
          ),
        );

        if (href && title) {
          const idMatch = href.match(/\/(?:manga|obras|series)\/([^/]+)/);
          const mangaId = idMatch
            ? (idMatch[1] as string)
            : href.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");

          if (!items.some((it) => (it as any).mangaId === mangaId)) {
            items.push({
              mangaId,
              title,
              imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
              contentRating: ContentRating.EVERYONE,
            });
          }
        }
      });
    };

    parseResults($);

    // Fallback: If 0 items and wp-manga didn't match, try generic search
    if (items.length === 0) {
      try {
        const fallbackUrl =
          page > 1
            ? `${BASE_URL}/obras/page/${page}/?s=${encodeURIComponent(searchTerm)}`
            : `${BASE_URL}/obras/?s=${encodeURIComponent(searchTerm)}`;
        const fallbackReq = { url: fallbackUrl, method: "GET" };
        const [fRes, fBuf] = await Application.scheduleRequest(fallbackReq);
        const fData = Application.arrayBufferToUTF8String(fBuf);
        await this.checkCloudflare(fRes, fData);
        parseResults(cheerio.load(fData));
      } catch (e) {
        if (e instanceof CloudflareError) throw e;
      }
    }

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = mangaId.startsWith("http") ? mangaId : `${BASE_URL}/obras/${mangaId}/`;
    const request = { url, method: "GET" };
    let [response, buffer] = await Application.scheduleRequest(request);
    let data = Application.arrayBufferToUTF8String(buffer);

    await this.checkCloudflare(response, data);

    let $ = cheerio.load(data);

    let title = $(".post-title h1, .manga-title h1, h1.entry-title, .manga-info h1, h1")
      .first()
      .text()
      .trim();

    // Fallback if title not found
    if (!title && !mangaId.startsWith("http")) {
      try {
        const fallbackUrl = `${BASE_URL}/manga/${mangaId}/`;
        const fallbackReq = { url: fallbackUrl, method: "GET" };
        const [fRes, fBuf] = await Application.scheduleRequest(fallbackReq);
        const fData = Application.arrayBufferToUTF8String(fBuf);
        await this.checkCloudflare(fRes, fData);
        if (fRes.status === 200) {
          $ = cheerio.load(fData);
          title = $(".post-title h1, .manga-title h1, h1.entry-title, .manga-info h1, h1")
            .first()
            .text()
            .trim();
        }
      } catch (e) {
        if (e instanceof CloudflareError) throw e;
      }
    }

    if (!title) title = "Sem título";

    const rawImage = getImageSrc(
      $(".summary_image img, .manga-thumb img, .thumb img, .item-thumb img"),
    );
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".description-summary .summary__content, .summary_content, .manga-excerpt, .entry-content p",
    )
      .text()
      .trim();
    const author = $(".author-content a, .manga-authors a").first().text().trim() || "Desconhecido";
    const statusText = $(".post-status .post-content_item .summary-content")
      .last()
      .text()
      .trim()
      .toLowerCase();

    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) status = "COMPLETED";

    const genres: Tag[] = [];
    $(".genres-content a, .manga-genres a").each((_, el) => {
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

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const baseUrlManga = sourceManga.mangaId.startsWith("http")
      ? sourceManga.mangaId
      : `${BASE_URL}/obras/${sourceManga.mangaId}`;
    const url = `${baseUrlManga.replace(/\/$/, "")}/ajax/chapters/`;
    const request = {
      url,
      method: "POST",
    };

    const chapters: Chapter[] = [];
    try {
      const [res, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      await this.checkCloudflare(res, data);

      const $ = cheerio.load(data);
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
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
    }

    if (chapters.length === 0) {
      const getUrl = sourceManga.mangaId.startsWith("http")
        ? sourceManga.mangaId
        : `${BASE_URL}/obras/${sourceManga.mangaId}/`;
      const getReq = { url: getUrl, method: "GET" };
      const [res, buffer] = await Application.scheduleRequest(getReq);
      const data = Application.arrayBufferToUTF8String(buffer);
      await this.checkCloudflare(res, data);

      const $ = cheerio.load(data);
      $(
        ".wp-manga-chapter, .chapter-item, .chapter-item.parent, li.chapter, .listing-chapters_wrap li",
      ).each((_, el) => {
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

    await this.checkCloudflare(response, data);

    const $ = cheerio.load(data);

    const pages: string[] = [];
    $(
      "[id^='pges_'] img, [id*='pges'] img, .page-break img, .reading-content img, .chapter-content img, .entry-content img, #readerarea img, .container-chapter-reader img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (src) pages.push(src);
    });

    if (pages.length === 0) {
      throw new Error(
        "Não foi possível carregar as imagens do capítulo. Formato não suportado ou proteção Cloudflare ativa.",
      );
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}
export const SakuraMangas = new SakuraMangasExtension();
