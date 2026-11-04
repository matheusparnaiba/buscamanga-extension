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

import { HentaiFusionAdvancedSearchForm, SettingsForm } from "./forms";
import type { HentaiFusionSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type HentaiFusionConfig from "./pbconfig";

const BASE_URL = "https://hentaifusion.me";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class HentaiFusionExtension implements ExtensionImpl<typeof HentaiFusionConfig> {
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
    return new HentaiFusionAdvancedSearchForm({
      title: "",
      metadata: { category: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Destaques & Recentes",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $("div.lista > ul > li").each((_, el) => {
        const link = $(el).find("div.thumb-conteudo > a").first();
        const href = link.attr("href") || "";
        if (!href.includes("hentaifusion.me") && !href.startsWith("/")) return;

        const title = link.attr("title") || $(el).find("span.thumb-titulo").text().trim();
        const img = sanitizeImageUrl(link.find("img").attr("src") || "");

        const mangaId = href
          .replace("https://hentaifusion.me/", "")
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
            type: "prominentCarouselItem",
          });
        }
      });

      return {
        items,
        metadata: items.length >= 10 ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no HentaiFusion:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<HentaiFusionSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/`;
    if (page > 1) url += `page/${page}/`;
    if (query.title) url += `?s=${encodeURIComponent(query.title)}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      $("div.lista > ul > li").each((_, el) => {
        const link = $(el).find("div.thumb-conteudo > a").first();
        const href = link.attr("href") || "";
        if (!href.includes("hentaifusion.me") && !href.startsWith("/")) return;

        const title = link.attr("title") || $(el).find("span.thumb-titulo").text().trim();
        const img = sanitizeImageUrl(link.find("img").attr("src") || "");

        const mangaId = href
          .replace("https://hentaifusion.me/", "")
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
      console.error("Erro na busca do HentaiFusion:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = $("h1.post-titulo").first().text().trim() || mangaId;
    const img = sanitizeImageUrl($("div.post-capa img").first().attr("src") || "");
    const synopsis = $("div.post-texto p").first().text().trim();

    const tags: Tag[] = [];
    $("ul.post-itens a[href*='/category/'], ul.post-itens a[href*='/tag/']").each((_, el) => {
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
        status: "COMPLETED",
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
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

    $("ul.post-fotos > li > img").each((_, el) => {
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

export const HentaiFusion = new HentaiFusionExtension();
