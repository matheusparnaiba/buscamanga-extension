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
  type SourceManga,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

const BASE_URL = "https://mangasbrasuka.com.br";

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

export class MangasBrasukaExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "manhwa",
        title: "Destaques Manhwa",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "manhua",
        title: "Destaques Manhua",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "shonen",
        title: "Mangás Shōnen",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "seinen",
        title: "Mangás Seinen",
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

    const tagSections = ["popular", "manhwa", "manhua", "shonen", "seinen"];
    if (tagSections.includes(section.id) && page > 1) {
      return { items: [], metadata: undefined };
    }
    if (section.id === "popular") {
      url = BASE_URL;
    } else if (section.id === "manhwa") {
      url = `${BASE_URL}/manga-tag/manhwa/`;
    } else if (section.id === "manhua") {
      url = `${BASE_URL}/manga-tag/manhua/`;
    } else if (section.id === "shonen") {
      url = `${BASE_URL}/manga-tag/shonen/`;
    } else if (section.id === "seinen") {
      url = `${BASE_URL}/manga-tag/seinen/`;
    }

    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    if (tagSections.includes(section.id)) {
      $(".manga-slider .slider__item, .widget-content .item-summary, .page-item-detail, .c-tabs-item__content")
        .slice(0, 15)
        .each((_, el) => {
          const titleEl = $(el).find(".post-title a, h3 a, h4 a, h5 a, .manga-title").first();
          const title = titleEl.text().trim();
          const href = titleEl.attr("href") || $(el).find("a").first().attr("href");
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

    if (section.id === "updates") {
      $(".page-item-detail, .manga-item").each((_, el) => {
        const titleEl = $(el).find(".post-title a, h3 a, .manga-title").first();
        const title = titleEl.text().trim();
        const href = titleEl.attr("href") || $(el).find("a").first().attr("href");
        const img = getImageSrc($(el).find("img"));
        const chapterEl = $(el).find(".chapter-item .chapter a, .chapter-list a").first();
        const chapterSubtitle = chapterEl.text().trim();
        const chapterHref = chapterEl.attr("href") || "unknown";

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          items.push({
            mangaId,
            chapterId: chapterHref,
            title,
            subtitle: chapterSubtitle || undefined,
            imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
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

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(
    query: SearchQuery<ContentTemplateSearchMetadata>,
  ): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchTerm = query.title ?? "";
    const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;

    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".c-tabs-item__content, .page-item-detail").each((_, el) => {
      const titleEl = $(el).find(".post-title a, h3 a, h4 a").first();
      const title = titleEl.text().trim();
      const href = titleEl.attr("href") || $(el).find("a").first().attr("href");
      const img = getImageSrc($(el).find("img"));

      if (href && title) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        items.push({
          mangaId,
          title,
          imageUrl: img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(title),
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

    const title = $(".post-title h1").text().trim() || mangaId;
    const rawImage = getImageSrc($(".summary_image img"));
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage = "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const thumbnailUrl = image || fallbackImage;
    const author = $(".author-content a").text().trim() || "Desconhecido";
    const synopsis =
      $(".description-summary p, .summary__content p").text().trim() || "Sem descrição.";

    let status = "ONGOING";
    const statusText = $(".post-status .summary-content").text().toLowerCase();
    if (statusText.includes("completo") || statusText.includes("completed")) status = "COMPLETED";

    const tagGroups: { id: string; title: string; tags: { id: string; title: string }[] }[] = [];
    const genres: { id: string; title: string }[] = [];
    $(".genres-content a").each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push({ id: encodeURI(g), title: g });
    });
    if (genres.length > 0) {
      tagGroups.push({ id: "genres", title: "Gêneros", tags: genres });
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
        author,
        tagGroups,
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/ajax/chapters/`;
    const request = { url, method: "POST" };
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

      if (href) {
        chapters.push({
          chapterId: href,
          sourceManga,
          langCode: "PT-BR",
          chapNum,
          title: name,
          volume: 0,
        });
      }
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

    // Check if normal reader images exist directly
    $(".reading-content img, .page-break img, .blocks-gallery-item img").each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        !src.includes("background-foto") &&
        !src.includes("tutorial") &&
        !src.includes("icons8")
      ) {
        pages.push(src);
      }
    });

    if (pages.length > 0) {
      return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        pages,
      };
    }

    // Fallback: extract base CDN URL from jump links or raw data
    let firstPageUrl = "";
    const cleanData = data.replace(/\\\//g, "/");
    const cdnMatch = cleanData.match(/https:\/\/cdn\.mugiverso\.com\/[^"'\s<>&]+\/(?:001|01|1)\.(?:webp|jpg|png)/i);
    if (cdnMatch && cdnMatch[0]) {
      firstPageUrl = cdnMatch[0];
    } else {
      const paramMatch = cleanData.match(/[?&](?:a|auth|u|url)=(https?%3A%2F%2F[^&"'\s<>]+|https?:\/\/[^&"'\s<>]+)/i);
      if (paramMatch && paramMatch[1]) {
        try {
          const decoded = decodeURIComponent(paramMatch[1]);
          const subMatch = decoded.match(/https:\/\/cdn\.mugiverso\.com\/[^"'\s<>&]+\/(?:001|01|1)\.(?:webp|jpg|png)/i);
          if (subMatch && subMatch[0]) firstPageUrl = subMatch[0];
          else firstPageUrl = decoded;
        } catch {
          firstPageUrl = paramMatch[1];
        }
      }
    }

    if (firstPageUrl) {
      const extMatch = firstPageUrl.match(/^(.*\/)(0*1)\.(webp|jpg|png)(?:\?.*)?$/i);
      if (extMatch && extMatch[1] && extMatch[2] && extMatch[3]) {
        const baseUrl = extMatch[1];
        const padLength = extMatch[2].length;
        const ext = extMatch[3];
        const formatNum = (num: number): string => String(num).padStart(padLength, "0");

        const checkPage = async (num: number): Promise<boolean> => {
          try {
            const [res] = await Application.scheduleRequest({
              url: `${baseUrl}${formatNum(num)}.${ext}`,
              method: "HEAD",
            });
            return res.status === 200;
          } catch {
            return false;
          }
        };

        let lastOk = 1;
        for (let step = 10; step <= 250; step += 10) {
          const ok = await checkPage(step);
          if (ok) lastOk = step;
          else break;
        }

        let totalPages = lastOk;
        for (let i = lastOk + 1; i <= lastOk + 10; i++) {
          const ok = await checkPage(i);
          if (ok) totalPages = i;
          else break;
        }

        for (let i = 1; i <= totalPages; i++) {
          pages.push(`${baseUrl}${formatNum(i)}.${ext}`);
        }
      } else {
        pages.push(firstPageUrl);
      }
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}
export const MangasBrasuka = new MangasBrasukaExtension();
