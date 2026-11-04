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

import { AnimeXNovelAdvancedSearchForm, SettingsForm } from "./forms";
import type { AnimeXNovelSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type AnimeXNovelConfig from "./pbconfig";

const BASE_URL = "https://www.animexnovel.com";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class AnimeXNovelExtension implements ExtensionImpl<typeof AnimeXNovelConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 8,
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
    return new AnimeXNovelAdvancedSearchForm({
      title: "",
      metadata: { order: "latest" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "latest",
        title: "Últimos Mangás & Manhwas",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    _metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const url = `${BASE_URL}/`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $(".axn-piz-card, a.axn-card").each((_, el) => {
        const link = $(el).is("a") ? $(el) : $(el).find("a").first();
        const href = link.attr("href") || "";
        const title =
          $(el).find("h2, h3, .search-content, .axn-piz-title").first().text().trim() ||
          link.text().trim();
        const img = sanitizeImageUrl(link.find("img").attr("src") || "");

        const mangaId = href
          .replace(/^https?:\/\/[^/]+\//, "")
          .replace(/^\/+/, "")
          .replace(/\/+$/, "");

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
            type: "prominentCarouselItem",
          });
        }
      });

      return {
        items,
        metadata: undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no AnimeXNovel:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<AnimeXNovelSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const bodyStr = `action=axn_filter_obras&posts_per_page=21&search=${encodeURIComponent(query.title || "")}&paged=${page}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: `${BASE_URL}/wp-admin/admin-ajax.php`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: bodyStr,
      });

      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      $("a.axn-card").each((_, el) => {
        const href = $(el).attr("href") || "";
        const title =
          $(el).find("h2, h3, .search-content").first().text().trim() || $(el).text().trim();
        const img = sanitizeImageUrl($(el).find("img").attr("src") || "");

        const mangaId = href
          .replace(/^https?:\/\/[^/]+\//, "")
          .replace(/^\/+/, "")
          .replace(/\/+$/, "");

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
          });
        }
      });

      return {
        items,
        metadata: items.length >= 20 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do AnimeXNovel:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = $("h1, h2.entry-title").first().text().trim() || mangaId;
    const img = sanitizeImageUrl(
      $(".axn-poster img, .entry-content img").first().attr("src") || "",
    );
    const synopsis = $(".sinopse, .entry-content p, #axn-data").first().text().trim();

    const tags: Tag[] = [];
    $(".axn-genre, a[rel='tag']").each((_, el) => {
      const gTitle = $(el).text().trim();
      if (gTitle) {
        tags.push({ id: gTitle.toLowerCase().replace(/\s+/g, "-"), title: gTitle });
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl:
          img || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
        synopsis,
        status: "ONGOING",
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        contentRating: ContentRating.EVERYONE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `${BASE_URL}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const category = $("[data-categoria]").first().attr("data-categoria");
    if (!category) return [];

    const chapters: Chapter[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= 5; page++) {
      try {
        const [__, chBuffer] = await Application.scheduleRequest({
          url: `${BASE_URL}/wp-json/axn/v1/chapters/${category}?page=${page}`,
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const chText = Application.arrayBufferToUTF8String(chBuffer);
        const list: { id: number; title: string; link: string }[] = JSON.parse(chText);
        if (!list || list.length === 0) break;

        for (const item of list) {
          const rawTitle = item.title;
          const chapMatch = rawTitle.match(
            /(?:capitulo|cap[.\s]|ch[.\s]|ep[.\s]|#)\s*(\d+(?:[.,]\d+)?)/i,
          );
          const chapNum = chapMatch?.[1] ? parseFloat(chapMatch[1].replace(",", ".")) : item.id;

          const chapterId = item.link
            .replace(/^https?:\/\/[^/]+\//, "")
            .replace(/^\/+/, "")
            .replace(/\/+$/, "");

          if (!seenIds.has(chapterId)) {
            seenIds.add(chapterId);
            chapters.push({
              chapterId,
              sourceManga,
              title: rawTitle,
              chapNum,
              langCode: "pt-br",
            });
          }
        }
      } catch {
        break;
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${BASE_URL}/${chapter.chapterId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const pages: string[] = [];
    const seen = new Set<string>();

    $(
      ".spice-block-img-gallery img, .wp-block-gallery img, .spnc-entry-content img, .leitor-cascata img, div.entry-content img",
    ).each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      const clean = sanitizeImageUrl(src);
      if (clean && !clean.startsWith("data:") && !seen.has(clean)) {
        seen.add(clean);
        pages.push(clean);
      }
    });

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const AnimeXNovel = new AnimeXNovelExtension();
