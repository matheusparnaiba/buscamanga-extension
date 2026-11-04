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

import { SettingsForm, SuperEcchiAdvancedSearchForm } from "./forms";
import type { SuperEcchiSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type SuperEcchiConfig from "./pbconfig";

const BASE_URL = "https://superecchi.com";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  else if (!src.startsWith("http")) src = `${BASE_URL}/${src}`;
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class SuperEcchiExtension implements ExtensionImpl<typeof SuperEcchiConfig> {
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
    return new SuperEcchiAdvancedSearchForm({
      title: "",
      metadata: { order: "latest" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "latest",
        title: "Lançamentos Mais Recentes",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const url = `${BASE_URL}/index.php?pageId=${page}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $(
        ".gallery-content > div.cg, .gallery-content > div.dj, .gallery-content > div.manga, .gallery-content > div.hq, .gallery-content > div.anime, .gallery-content > div.acg",
      ).each((_, el) => {
        const link = $(el).find("h2 a.titulo-linhas, h2 a, a").first();
        const href = link.attr("href") || "";
        const title = link.text().trim();
        const img = sanitizeImageUrl($(el).find(".dj-img1 img, img").first().attr("src") || "");

        const mangaId = href.replace(/^\/+/, "");

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

      const hasNext = $(".pagination a[href*='pageId=" + (page + 1) + "']").length > 0;

      return {
        items,
        metadata: hasNext ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no SuperEcchi:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<SuperEcchiSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    if (!query.title) {
      const disc = await this.getDiscoverSectionItems(
        { id: "latest", title: "", type: DiscoverSectionType.simpleCarousel },
        page,
      );
      const items: SearchResultItem[] = [];
      for (const item of disc.items) {
        if ("mangaId" in item) {
          items.push({
            mangaId: item.mangaId,
            title: item.title,
            imageUrl: item.imageUrl,
            subtitle: "subtitle" in item ? (item as { subtitle?: string }).subtitle : undefined,
          });
        }
      }
      return { items, metadata: disc.metadata };
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: `${BASE_URL}/ajax_pesquisar.php`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: `id=${encodeURIComponent(query.title)}`,
      });

      const text = Application.arrayBufferToUTF8String(buffer);
      let suggestions: string[] = [];
      try {
        suggestions = JSON.parse(text);
      } catch {}

      const items: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      for (const sug of suggestions.slice(0, 5)) {
        const name = sug.replace(/\s*\([^)]+\)$/, "").trim();
        if (!name) continue;
        const seo = name.replace(/-/g, "*").replace(/\s+/g, "-");
        const listUrl = `${BASE_URL}/tag.php?tag=${encodeURIComponent(seo)}`;

        try {
          const [__, sBuffer] = await Application.scheduleRequest({ url: listUrl, method: "GET" });
          const sHtml = Application.arrayBufferToUTF8String(sBuffer);
          const $ = cheerio.load(sHtml);

          $(
            ".gallery-content > div.cg, .gallery-content > div.dj, .gallery-content > div.manga, .gallery-content > div.hq",
          ).each((_, el) => {
            const link = $(el).find("h2 a.titulo-linhas, h2 a, a").first();
            const href = link.attr("href") || "";
            const title = link.text().trim();
            const img = sanitizeImageUrl($(el).find(".dj-img1 img, img").first().attr("src") || "");

            const mangaId = href.replace(/^\/+/, "");

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
        } catch {}
      }

      return {
        items,
        metadata: undefined,
      };
    } catch (e) {
      console.error("Erro na busca do SuperEcchi:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title =
      $("h1")
        .first()
        .text()
        .replace(/^Album:/i, "")
        .trim() || mangaId;
    const img = sanitizeImageUrl($(".dj-img1 img").first().attr("src") || "");
    const synopsis = $(".sinopse-completa")
      .first()
      .text()
      .replace(/^Sinopse:/i, "")
      .trim();

    let author: string | undefined;
    $("table.dj-desc tr").each((_, tr) => {
      const td0 = $(tr).find("td").first().text().trim().toLowerCase();
      if (td0.includes("autor")) {
        author = $(tr).find("td").eq(1).text().trim() || undefined;
      }
    });

    const tags: Tag[] = [];
    $("td.relatedtags a").each((_, el) => {
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
        author,
        status: "COMPLETED",
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        contentRating: ContentRating.MATURE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `${BASE_URL}/${mangaId}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const chapters: Chapter[] = [];
    const seenIds = new Set<string>();

    $("a[href^='leitor.php?t=']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const chapterId = href.replace(/^\/+/, "");
      const slug = chapterId.replace("leitor.php?t=", "");
      const lastNum = slug.split("-").pop() || "1";
      const chapNum = parseFloat(lastNum) || 1;

      if (!seenIds.has(chapterId)) {
        seenIds.add(chapterId);
        chapters.push({
          chapterId,
          sourceManga,
          title: `Capítulo ${chapNum}`,
          chapNum,
          langCode: "pt-br",
        });
      }
    });

    if (chapters.length === 0) {
      chapters.push({
        chapterId: mangaId,
        sourceManga,
        title: "Capítulo Único",
        chapNum: 1,
        langCode: "pt-br",
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${BASE_URL}/${chapter.chapterId}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const pages: string[] = [];
    const seen = new Set<string>();

    $("#gerar_pdf img[src^='mangas/'], #gerar_pdf img, div.leitor img").each((_, el) => {
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

export const SuperEcchi = new SuperEcchiExtension();
