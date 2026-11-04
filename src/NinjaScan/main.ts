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
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

const BASE_URL = "https://ninjacomics.xyz";
const MANGA_SUB = "manga";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src =
    $img.attr("data-page-url") ||
    $img.attr("data-lzl-src") ||
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    "";

  if (!src) {
    const srcset = $img.attr("data-lzl-srcset") || $img.attr("srcset");
    if (srcset) {
      src = srcset.split(",")[0]?.trim()?.split(" ")[0]?.trim() || "";
    }
  }

  if (!src || src.startsWith("data:")) {
    const rawSrc = $img.attr("src") || $img.attr("data-cfsrc") || "";
    if (rawSrc && !rawSrc.startsWith("data:")) {
      src = rawSrc;
    }
  }

  if (!src || src.startsWith("data:")) {
    const noscript = $img.parent().find("noscript").text();
    const match = noscript.match(/src=["']([^"']+)["']/i);
    if (match?.[1]) src = match[1];
  }

  return sanitizeImageUrl(src);
}

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-zA-Z0-9._\-@()[\]%?#+=/&:]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

function parsePortugueseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const str = dateStr
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const now = new Date();

  if (str.includes("agora") || str.includes("just now") || str === "hoje" || str === "today") {
    return now;
  }
  if (str.includes("ontem") || str.includes("yesterday")) {
    return new Date(now.getTime() - 86400 * 1000);
  }

  const minMatch = str.match(/(\d+)\s*(?:minutos?|mins?)/);
  if (minMatch?.[1]) return new Date(now.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);

  const hourMatch = str.match(/(\d+)\s*(?:horas?|h)/);
  if (hourMatch?.[1]) return new Date(now.getTime() - parseInt(hourMatch[1], 10) * 3600 * 1000);

  const dayMatch = str.match(/(\d+)\s*(?:dias?|days?)/);
  if (dayMatch?.[1]) return new Date(now.getTime() - parseInt(dayMatch[1], 10) * 86400 * 1000);

  const dmyMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch?.[1] && dmyMatch[2] && dmyMatch[3]) {
    const yr =
      dmyMatch[3].length === 2 ? 2000 + parseInt(dmyMatch[3], 10) : parseInt(dmyMatch[3], 10);
    return new Date(yr, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export class NinjaScanExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "views", genre: "all", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "latest",
        title: "Lançamentos Recentes",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/`;

    if (section.id === "popular") {
      url = `${BASE_URL}/${MANGA_SUB}/?m_orderby=views&page=${page}`;
    } else if (section.id === "latest") {
      url = `${BASE_URL}/${MANGA_SUB}/?m_orderby=latest&page=${page}`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $(
        "div.page-item-detail, div.manga, div.col-6.col-md-3, div.col-6.col-md-2, div.badge-pos-1, article, div.c-tabs-item__content",
      ).each((_, el) => {
        const link = $(el).find(`a[href*='/${MANGA_SUB}/']`).first();
        const href = link.attr("href") || "";
        const title =
          $(el).find(".post-title a, h3 a, h5 a, .heading a").first().text().trim() ||
          link.text().trim();
        const img = getImageSrc($(el).find("img").first());

        const idMatch = href.match(new RegExp(`/${MANGA_SUB}/([^/]+)`));
        const mangaId = idMatch?.[1] || "";

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          const chapLink = $(el)
            .find("span.chapter a, div.list-chapter div.chapter-item a")
            .first();
          const subtitle = chapLink.text().trim() || undefined;

          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
            subtitle,
            type: section.id === "popular" ? "prominentCarouselItem" : "simpleCarouselItem",
          });
        }
      });

      return {
        items,
        metadata: items.length >= 10 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no Ninja Scan:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title || "")}&post_type=wp-manga`;

    if (query.metadata?.orderBy) {
      url += `&m_orderby=${query.metadata.orderBy}`;
    }
    if (query.metadata?.genre && query.metadata.genre !== "all") {
      url += `&genre[]=${query.metadata.genre}`;
    }
    if (query.metadata?.status && query.metadata.status !== "all") {
      url += `&status[]=${query.metadata.status}`;
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      $(
        "div.c-tabs-item__content, div.row.c-tabs-item__content, div.page-item-detail, div.manga",
      ).each((_, el) => {
        const link = $(el).find(`a[href*='/${MANGA_SUB}/']`).first();
        const href = link.attr("href") || "";
        const title =
          $(el).find(".post-title a, h3 a, h4 a").first().text().trim() || link.text().trim();
        const img = getImageSrc($(el).find("img").first());

        const idMatch = href.match(new RegExp(`/${MANGA_SUB}/([^/]+)`));
        const mangaId = idMatch?.[1] || "";

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
            subtitle: $(el).find("span.chapter a").first().text().trim() || undefined,
          });
        }
      });

      return {
        items,
        metadata: items.length >= 10 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do Ninja Scan:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${MANGA_SUB}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title =
      $("div.post-title h1, h1.entry-title, .post-title h3")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() || mangaId;
    const img = getImageSrc($("div.summary_image img, div.tab-summary img").first());
    const description = $("div.description-summary, div.summary__content, div.manga-excerpt")
      .text()
      .trim();

    const author =
      $("div.author-content a, div.summary-heading:contains('Autor') + div a")
        .first()
        .text()
        .trim() || undefined;
    const artist =
      $("div.artist-content a, div.summary-heading:contains('Artista') + div a")
        .first()
        .text()
        .trim() || undefined;

    const rawStatus = $(
      "div.summary-heading:contains('Status') + div, div.post-status div.summary-content",
    )
      .first()
      .text()
      .toLowerCase();
    let status = "ONGOING";
    if (
      rawStatus.includes("completo") ||
      rawStatus.includes("conclu") ||
      rawStatus.includes("end")
    ) {
      status = "COMPLETED";
    }

    const tags: Tag[] = [];
    $(
      "div.genres-content a, div.summary-heading:contains('Gênero') + div a, div.tags-content a",
    ).each((_, el) => {
      const gTitle = $(el).text().trim();
      if (gTitle) {
        tags.push({ id: sanitizeTagId(gTitle), title: gTitle });
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl:
          img || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
        synopsis: description,
        author,
        artist,
        status,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        contentRating: ContentRating.EVERYONE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const mangaUrl = `${BASE_URL}/${MANGA_SUB}/${mangaId}/`;
    let html = "";

    try {
      // First try standard page load
      const [_, buffer] = await Application.scheduleRequest({ url: mangaUrl, method: "GET" });
      html = Application.arrayBufferToUTF8String(buffer);

      // If chapter list is loaded via AJAX
      if (!html.includes("wp-manga-chapter")) {
        const ajaxUrl = `${mangaUrl}ajax/chapters/`;
        const [__, ajaxBuffer] = await Application.scheduleRequest({
          url: ajaxUrl,
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        const ajaxHtml = Application.arrayBufferToUTF8String(ajaxBuffer);
        if (ajaxHtml.includes("wp-manga-chapter")) {
          html = ajaxHtml;
        }
      }
    } catch {
      // Fallback to AJAX endpoint
      const ajaxUrl = `${mangaUrl}ajax/chapters/`;
      const [__, ajaxBuffer] = await Application.scheduleRequest({
        url: ajaxUrl,
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      html = Application.arrayBufferToUTF8String(ajaxBuffer);
    }

    const $ = cheerio.load(html);
    const chapters: Chapter[] = [];
    const seenIds = new Set<string>();

    $("li.wp-manga-chapter").each((index, el) => {
      const link = $(el).find("a").first();
      const href = link.attr("href") || "";
      const rawTitle = link.text().trim();
      const dateStr = $(el).find("span.chapter-release-date").text().trim();
      const publishDate = parsePortugueseDate(dateStr);

      const chapNumMatch = rawTitle.match(
        /(?:capitulo|cap[.\s]|ch[.\s]|ep[.\s]|#)\s*(\d+(?:[.,]\d+)?)/i,
      );
      const chapNum = chapNumMatch?.[1] ? parseFloat(chapNumMatch[1].replace(",", ".")) : index + 1;

      // Extract chapterId from URL
      let chapterId = href.replace(BASE_URL, "").replace(/^\/+/, "").replace(/\/+$/, "");
      if (!chapterId) {
        chapterId = `${mangaId}-cap-${chapNum}`;
      }

      if (!seenIds.has(chapterId)) {
        seenIds.add(chapterId);
        chapters.push({
          chapterId,
          sourceManga,
          title: rawTitle || `Capítulo ${chapNum}`,
          chapNum,
          publishDate,
          langCode: "pt-br",
        });
      }
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    let url = chapter.chapterId.startsWith("http")
      ? chapter.chapterId
      : `${BASE_URL}/${chapter.chapterId}/`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);
    const pages: string[] = [];
    const seenPages = new Set<string>();

    $(
      "div.page-break img, div.reading-content img, img.wp-manga-chapter-img, canvas.protected-chapter-canvas[data-page-url], div.entry-content img",
    ).each((_, el) => {
      const src =
        $(el).attr("data-page-url") ||
        $(el).attr("data-src") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("src") ||
        "";

      const cleanSrc = sanitizeImageUrl(src);
      if (cleanSrc && !cleanSrc.startsWith("data:") && !seenPages.has(cleanSrc)) {
        seenPages.add(cleanSrc);
        pages.push(cleanSrc);
      }
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const NinjaScan = new NinjaScanExtension();
