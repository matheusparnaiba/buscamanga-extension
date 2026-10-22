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

declare const App: any;

const BASE_URL = "https://mangalivre.blog";

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src =
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    $img.attr("srcset")?.split(" ")[0] ||
    $img.attr("src") ||
    $img.attr("data-cfsrc") ||
    "";
  src = src.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  return src.startsWith("/") ? BASE_URL + src : src;
}

export class MangaLivreBlogExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "recommended",
        title: "Recomendados",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/page/${page}/`;

    if ((section.id === "popular" || section.id === "recommended") && page > 1) {
      return { items: [], metadata: undefined };
    }

    const request = {
      url,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      let populars = $(
        ".home-popular article.home-manga-card, .home-popular .home-manga-card, .manga-card-modern, .sidebar .popular-item-wrap, .popular-item-wrap",
      );

      populars.toArray().forEach((el) => {
        const title = $(el)
          .find(".home-card-body h3 a, .manga-title-modern, .manga-title, h3 a, h3")
          .first()
          .text()
          .trim();
        const subtitle = $(el)
          .find(".home-card-chapters a, .chapter-item-modern a")
          .first()
          .text()
          .trim()
          .replace(/\s+/g, " ");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());
        const href = $(el).find("a.home-manga-cover, a.manga-cover-link, a").first().attr("href");

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
      const updates = $(
        ".home-latest article.home-manga-card, .home-latest .home-manga-card, article.home-manga-card, .manga-card-modern",
      );

      updates.each((_, el) => {
        const title = $(el)
          .find(".home-card-body h3 a, .manga-title-modern, .manga-title, h3 a, h3")
          .first()
          .text()
          .trim();
        const href = $(el).find("a.home-manga-cover, a.manga-cover-link, a").first().attr("href");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());
        const chapterEl = $(el).find(".home-card-chapters a, .chapter-item-modern a").first();
        const chapterSubtitle = chapterEl.text().trim().replace(/\s+/g, " ");
        const chapterHref = chapterEl.attr("href") || "unknown";

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

    if (section.id === "recommended") {
      let recommended = $(".home-featured-slide");
      if (recommended.length === 0) {
        recommended = $(
          ".home-popular article.home-manga-card, .home-popular .home-manga-card, .manga-card-modern",
        );
      }

      recommended.each((_, el) => {
        const title = $(el)
          .find(".home-featured-title, .home-card-body h3 a, h1, h2, h3")
          .first()
          .text()
          .trim();
        const href = $(el)
          .find("a.home-featured-cover, a.home-manga-cover, a[href*='/manga/']")
          .first()
          .attr("href");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
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
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title)}`;

    const request = { url: searchUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".manga-card, .c-tabs-item__content, article.home-manga-card").each((_, el) => {
      const linkEl = $(el).find("a.manga-card-link, .post-title h3 a, a[href*='/manga/']").first();
      const href = linkEl.attr("href");
      const title = $(el)
        .find(".manga-card-title, h3 a, h3, .post-title h3 a")
        .first()
        .text()
        .trim();
      const img = getImageSrc($(el).find("img.manga-cover-img, .tab-thumb a img, img").first());

      if (href && title) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        items.push({
          mangaId,
          title,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title || "Manga") +
              "&background=random",
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
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $(".manga-title, .post-title h1, h1")
        .filter((_, el) => !$(el).hasClass("site-title"))
        .first()
        .text()
        .trim() ||
      $("h1")
        .map((_, el) => $(el).text().trim())
        .get()
        .find((t) => t.length > 0) ||
      "";

    const rawImage = getImageSrc(
      $(
        ".manga-cover img, img.manga-cover-img, .manga-poster img, .manga-info img, .summary_image img",
      ).first(),
    );
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(title || "Manga") +
      "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".synopsis-content, .manga-synopsis, .synopsis, .description-summary .summary__content, .manga-description",
    )
      .first()
      .text()
      .replace(/^Sinopse\s*/i, "")
      .trim();

    let author = "";
    let statusText = "";
    $(".manga-meta-item, .post-content_item").each((_, el) => {
      const txt = $(el).text().trim();
      if (!author && txt.includes("Autor:")) author = txt.replace("Autor:", "").trim();
      if (!statusText && txt.includes("Status:"))
        statusText = txt.replace("Status:", "").trim().toLowerCase();
    });

    if (!author) {
      author = $(".author-content a").text().trim() || "Desconhecido";
    }

    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) {
      status = "COMPLETED";
    }

    const genres: Tag[] = [];
    const addedGenres = new Set<string>();
    $(
      ".manga-tags .manga-tag, .genres-content a, .manga-genres a, .genres a, a[href*='/genero/'], a[href*='/genre/']",
    ).each((_, el) => {
      const g = $(el).text().trim();
      if (g && !addedGenres.has(g) && !/^\d+$/.test(g)) {
        addedGenres.add(g);
        genres.push({ id: encodeURI(g), title: g });
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title || "Sem título",
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: synopsis === "Sinopse" ? "" : synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: author || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Genres", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/`;
    const request = {
      url,
      method: "GET",
    };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const chapters: Chapter[] = [];
    const addedUrls = new Set<string>();

    const parseChapterElements = ($root: cheerio.CheerioAPI) => {
      $root("li.chapter-item, .chapter-item, .wp-manga-chapter").each((_, el) => {
        const a = $root(el).find("a.chapter-link, a").first();
        const href = a.attr("href")?.trim() || "";
        if (!href || addedUrls.has(href)) return;
        addedUrls.add(href);

        let name = a.find(".chapter-number").text().trim() || a.text().trim();
        name = name.replace(/\s+/g, " ").trim();

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
    };

    parseChapterElements($);

    const btn = $("#sr-load-chapters");
    const mangaNumId = btn.attr("data-manga");
    let offset = parseInt(btn.attr("data-offset") || "0", 10);
    const total = parseInt(btn.attr("data-total") || "0", 10);

    if (mangaNumId && total > chapters.length) {
      while (offset < total) {
        try {
          const req = {
            url: `${BASE_URL}/wp-json/slimeread/v1/chapters/${mangaNumId}?offset=${offset}`,
            method: "GET",
          };
          const [__, apiBuffer] = await Application.scheduleRequest(req);
          const apiDataStr = Application.arrayBufferToUTF8String(apiBuffer);
          const apiData = JSON.parse(apiDataStr);
          if (!apiData.list) break;
          const $list = cheerio.load(`<ul>${apiData.list}</ul>`);
          parseChapterElements($list);
          if (apiData.offset <= offset) break;
          offset = apiData.offset;
          if (!apiData.has_more) break;
        } catch {
          break;
        }
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = chapter.chapterId;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    $(
      ".chapter-images img, .chapter-reader img, .page-break img, .reading-content img, .chapter-image img, #chapter-container img, article img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (src && !pages.includes(src) && !src.includes("logo") && !src.includes("avatar")) {
        pages.push(src);
      }
    });

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
export const MangaLivreBlog = new MangaLivreBlogExtension();
