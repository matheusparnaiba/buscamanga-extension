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

const BASE_URL = "https://mangalivre.to";

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

export class MangaLivreExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "featured",
        title: "Destaques",
        type: DiscoverSectionType.featured,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/page/${page}/`;

    if ((section.id === "popular" || section.id === "featured") && page > 1) {
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
        ".popular-statuses .widget-content .popular-item-wrap, .widget-content .popular-item-wrap, .popular-item-wrap, .popular-manga",
      );
      if (populars.length === 0) populars = $(".sidebar .popular-item-wrap");
      if (populars.length === 0) populars = $(".popular-item-wrap");

      populars.each((_, el) => {
        const title =
          $(el).find("a").attr("title")?.trim() || $(el).find("h3, .title").text().trim();
        const href = $(el).find("a").attr("href");
        const img = getImageSrc($(el).find("img"));
        const subtitle = $(el).find(".list-chapter .chapter-item .chapter a").first().text().trim();

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
      $(".manga-item, .page-item-detail").each((_, el) => {
        const title = $(el).find(".manga-title, h3, .post-title").text().trim();
        const href = $(el).find("a").first().attr("href");
        const img = getImageSrc($(el).find("img"));
        const chapterEl = $(el).find(".chapter-list .chapter-button").first();
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

    if (section.id === "featured") {
      const linkMap = new Map<string, string>();
      $('a[href*="/manga/"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          const m = href.match(/\/manga\/([^/]+)/);
          if (m && m[1]) {
            const slug = m[1];
            const text = $(el).attr("title") || $(el).text().trim();
            if (text) {
              linkMap.set(text.toLowerCase().trim(), slug);
            }
          }
        }
      });

      const addedIds = new Set<string>();

      $("li[data-featured-slider-item]").each((i, el) => {
        const pager = $(`#bx-pager a[data-slide-index="${i}"]`);
        const title =
          pager.find(".name").text().trim() || $(el).find(".chapter-number").text().trim();
        if (!title) return;

        const style = $(el).find(".destaque-image").attr("style") || "";
        const imgMatch = style.match(/url\(["']?([^"']+)["']?\)/);
        const img = imgMatch && imgMatch[1] ? imgMatch[1] : "";

        let slug = "";
        const tLow = title.toLowerCase();
        for (const [k, v] of linkMap.entries()) {
          if (k.includes(tLow) || tLow.includes(k)) {
            slug = v;
            break;
          }
        }

        if (!slug) {
          if (tLow.includes("one piece")) slug = "one-piece-ptbr";
          else if (tLow.includes("boruto")) slug = "boruto-two-blue-vortex-ptbr";
          else if (tLow.includes("beginning after")) slug = "the-beginning-after-the-end-ptbr";
          else if (tLow.includes("omniscient")) slug = "omniscient-reader";
          else if (tLow.includes("demonic master")) slug = "the-descent-of-the-demonic-master";
          else if (tLow.includes("skeleton")) slug = "solo-leveling";
          else slug = tLow.replace(/[^a-z0-9]+/g, "-") + "-ptbr";
        }

        if (slug && !addedIds.has(slug)) {
          addedIds.add(slug);
          items.push({
            mangaId: slug,
            title,
            imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
            type: "featuredCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });

      $(".popular-item-wrap").each((_, el) => {
        const a = $(el).find("a").first();
        const title = a.attr("title")?.trim() || $(el).find(".post-title").text().trim();
        const href = a.attr("href");
        const img = getImageSrc($(el).find("img"));

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch && idMatch[1] ? idMatch[1] : href;
          if (mangaId && !addedIds.has(mangaId)) {
            addedIds.add(mangaId);
            items.push({
              mangaId,
              title,
              imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
              type: "featuredCarouselItem",
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
      const img = getImageSrc($(el).find(".tab-thumb a img"));

      if (href) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        items.push({
          mangaId,
          title,
          imageUrl: img,
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

    const title = $(".post-title h1").text().trim();
    const image = getImageSrc($(".summary_image img"));
    const synopsis = $(".description-summary .summary__content").text().trim();
    const author = $(".author-content a").text().trim();
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
      genres.push({ id: encodeURI(g), title: g });
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
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/ajax/chapters/`;
    const request = {
      url,
      method: "POST",
    };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const chapters: Chapter[] = [];

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
    $(".page-break img, .reading-content img").each((_, el) => {
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
export const MangaLivre = new MangaLivreExtension();
