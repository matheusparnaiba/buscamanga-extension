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

import { SettingsForm, UniversoHentaiAdvancedSearchForm } from "./forms";
import type { UniversoHentaiSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type UniversoHentaiConfig from "./pbconfig";

const BASE_URL = "https://universohentai.com";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class UniversoHentaiExtension implements ExtensionImpl<typeof UniversoHentaiConfig> {
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
    return new UniversoHentaiAdvancedSearchForm({
      title: "",
      metadata: { category: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "latest",
        title: "Últimas Galerias",
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

      $("div.meio div.videos div.video a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!href.includes("universohentai.com") && !href.startsWith("/")) return;

        const title = $(el).find("span.video-titulo").text().trim() || $(el).attr("title") || "";
        const img = sanitizeImageUrl($(el).find("img").attr("src") || "");

        const mangaId = href
          .replace("https://universohentai.com/", "")
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
      console.error("Erro ao carregar seção " + section.id + " no UniversoHentai:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<UniversoHentaiSearchMetadata>,
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

      $("div.meio div.videos div.video a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!href.includes("universohentai.com") && !href.startsWith("/")) return;

        const title = $(el).find("span.video-titulo").text().trim() || $(el).attr("title") || "";
        const img = sanitizeImageUrl($(el).find("img").attr("src") || "");

        const mangaId = href
          .replace("https://universohentai.com/", "")
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
      console.error("Erro na busca do UniversoHentai:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = $("h1.post-titulo").first().text().trim() || mangaId;
    const author =
      $("ul.paginaPostItens li:contains('Artista') a").first().text().trim() || undefined;
    const img = sanitizeImageUrl($("div.paginaPostThumb img").first().attr("src") || "");

    const tags: Tag[] = [];
    $("ul.paginaPostItens li:contains('Categorias') a").each((_, el) => {
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
        synopsis: "",
        author,
        status: "COMPLETED",
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        contentRating: ContentRating.MATURE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `${BASE_URL}/${mangaId}/`;
    let chapterId = mangaId;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const galeriaLink = $("a[title='Abrir galeria']").first().attr("href");
      if (galeriaLink) {
        chapterId = galeriaLink
          .replace("https://universohentai.com/", "")
          .replace(/^\/+/, "")
          .replace(/\/+$/, "");
      }
    } catch {}

    return [
      {
        chapterId,
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

    $("div.meio div.galeria div.galeria-foto a img, div.galeria-foto img, div.meio img").each(
      (_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src") || "";
        const clean = sanitizeImageUrl(src);
        if (
          clean &&
          !clean.startsWith("data:") &&
          !seen.has(clean) &&
          !clean.includes("logo") &&
          !clean.includes("avatar")
        ) {
          seen.add(clean);
          pages.push(clean);
        }
      },
    );

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const UniversoHentai = new UniversoHentaiExtension();
