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
} from "@paperback/types";
import * as cheerio from "cheerio";

import { HentaiKaiAdvancedSearchForm, SettingsForm } from "./forms";
import type { HentaiKaiSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type HentaiKaiConfig from "./pbconfig";

const BASE_URL = "https://hentaikai.com";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class HentaiKaiExtension implements ExtensionImpl<typeof HentaiKaiConfig> {
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
    return new HentaiKaiAdvancedSearchForm({
      title: "",
      metadata: { category: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "mangas-hentai",
        title: "Mangás Hentai",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "hentais",
        title: "Últimos Lançamentos",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const cat = section.id === "hentais" ? "hentais" : "mangas-hentai";
    const url = page === 1 ? `${BASE_URL}/${cat}/` : `${BASE_URL}/${cat}/page/${page}/`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $("a:has(div.box-info-serie)").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!href.includes("hentaikai.com") && !href.startsWith("/")) return;

        const title = $(el).attr("title") || $(el).find("img").attr("alt") || "";
        const img = sanitizeImageUrl(
          $(el).find("img").attr("data-lazy-src") || $(el).find("img").attr("src") || "",
        );

        const mangaId = href
          .replace("https://hentaikai.com/", "")
          .replace(/^\/+/, "")
          .replace(/\/+$/, "");

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: title.trim(),
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
            type: section.id === "mangas-hentai" ? "prominentCarouselItem" : "simpleCarouselItem",
          });
        }
      });

      return {
        items,
        metadata: items.length >= 10 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no HentaiKai:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<HentaiKaiSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const cat =
      query.metadata?.category && query.metadata.category !== "all" ? query.metadata.category : "";
    let url = cat ? `${BASE_URL}/${cat}/` : `${BASE_URL}/`;
    if (page > 1) url += `page/${page}/`;
    if (query.title) url += `?s=${encodeURIComponent(query.title)}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      $("a:has(div.box-info-serie)").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!href.includes("hentaikai.com") && !href.startsWith("/")) return;

        const title = $(el).attr("title") || $(el).find("img").attr("alt") || "";
        const img = sanitizeImageUrl(
          $(el).find("img").attr("data-lazy-src") || $(el).find("img").attr("src") || "",
        );

        const mangaId = href
          .replace("https://hentaikai.com/", "")
          .replace(/^\/+/, "")
          .replace(/\/+$/, "");

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: title.trim(),
            imageUrl:
              img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
          });
        }
      });

      return {
        items,
        metadata: items.length >= 10 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do HentaiKai:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim() || mangaId;
    const img = sanitizeImageUrl(
      $("li img[data-src], div.box-thumb img").first().attr("data-src") ||
        $("li img[data-src], div.box-thumb img").first().attr("src") ||
        "",
    );
    const synopsis = $("div.box-sinopse, div.box-conteudo p").first().text().trim();

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl:
          img || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`,
        synopsis,
        status: "COMPLETED",
        tagGroups: [],
        contentRating: ContentRating.MATURE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        title: "Capítulo Único",
        chapNum: 1,
        langCode: "pt-br",
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${BASE_URL}/${chapter.chapterId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const pages: string[] = [];
    const seen = new Set<string>();

    $("li img[data-src], div.box-imagem img, div.leitor img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
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

export const HentaiKai = new HentaiKaiExtension();
