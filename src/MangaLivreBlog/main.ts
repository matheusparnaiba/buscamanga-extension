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
  src = src.trim().replace(/-\d+x\d+/g, "");
  return src.startsWith("/") ? BASE_URL + src : src;
}

export class MangaLivreBlogExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
      let populars = $(".manga-card-modern");
      if (populars.length === 0) populars = $(".sidebar .popular-item-wrap");
      if (populars.length === 0) populars = $(".popular-item-wrap");

      populars.toArray().forEach((el) => {
        const title = $(el).find(".manga-title-modern, .manga-title").text().trim();
        const subtitle = $(el).find(".chapter-item-modern a").first().text().trim();
        const img = getImageSrc($(el).find("img"));
        const href = $(el).find("a.manga-cover-link").attr("href");

        if (href) {
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
      $(".manga-card-modern").each((_, el) => {
        const title = $(el).find(".manga-title-modern, .manga-title").text().trim();
        const href = $(el).find("a.manga-cover-link").attr("href");
        const img = getImageSrc($(el).find("img"));
        const chapterEl = $(el).find(".chapter-item-modern a").first();
        const chapterSubtitle = chapterEl.text().trim();
        const chapterHref = chapterEl.attr("href") || "unknown";

        if (href) {
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
      $(".manga-card-modern, .sidebar .popular-item-wrap")
        .slice(0, 15)
        .each((_, el) => {
          const title = $(el).find(".manga-title-modern, .manga-title, h3, a").text().trim();
          const href = $(el).find("a.manga-cover-link, a").attr("href");
          const img = getImageSrc($(el).find("img"));

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
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title)}&post_type=wp-manga`;

    const request = { url: searchUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".c-tabs-item__content").each((_, el) => {
      const titleElement = $(el).find(".post-title h3 a");
      const title = titleElement.text().trim();
      const href = titleElement.attr("href");
      const img = getImageSrc($(el).find(".tab-thumb a img"));

      if (href) {
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
      $(".post-title h1, .manga-title, h1")
        .map((_, el) => $(el).text().trim())
        .get()
        .find((t) => t.length > 0) || "";
    const rawImage = getImageSrc(
      $(".manga-cover img, .manga-cover-image, .summary_image img").first(),
    );
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(title || "Manga") +
      "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".description-summary .summary__content, .manga-synopsis, .manga-description",
    )
      .first()
      .text()
      .trim();
    let author = $(".author-content a").text().trim();
    let statusText = $(".post-status .post-content_item .summary-content")
      .last()
      .text()
      .trim()
      .toLowerCase();

    $(".manga-meta-item").each((_, el) => {
      const txt = $(el).text().trim();
      if (!author && txt.includes("Autor:")) author = txt.replace("Autor:", "").trim();
      if (!statusText && txt.includes("Status:"))
        statusText = txt.replace("Status:", "").trim().toLowerCase();
    });

    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) status = "COMPLETED";

    const genres: Tag[] = [];
    $(".genres-content a, .manga-genres a, .genres a").each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push({ id: encodeURI(g), title: g });
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

    $("li.chapter-item, .chapter-item, .wp-manga-chapter").each((_, el) => {
      const a = $(el).find("a.chapter-link").first();
      const fallbackA = $(el).find("a").first();
      const href = a.attr("href")?.trim() || fallbackA.attr("href")?.trim() || "";
      if (!href || addedUrls.has(href)) return;
      addedUrls.add(href);

      let name =
        a.find(".chapter-number").text().trim() || a.text().trim() || fallbackA.text().trim();
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
      ".page-break img, .reading-content img, .chapter-image img, .chapter-images img, #chapter-container img, article img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (src && !pages.includes(src)) pages.push(src);
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}
export const MangaLivreBlog = new MangaLivreBlogExtension();
