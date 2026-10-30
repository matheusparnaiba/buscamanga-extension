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
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { BrasilHentaiSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type BrasilHentaiConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://brasilhentai.com";

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

function getItemImage($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
  let found = "";
  $el.find(".entry-content img, .post-thumbnail img, img").each((_, imgEl) => {
    const src = getImageSrc($(imgEl));
    if (
      src &&
      src.startsWith("http") &&
      !src.includes("logotipo") &&
      !src.includes("banner") &&
      !src.includes("gif-icon") &&
      !src.includes("new-gif") &&
      !src.endsWith(".gif")
    ) {
      found = src;
      return false;
    }
  });
  return found;
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

function extractMangaId(url: string): string {
  const clean = url
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/+|\/+$/g, "");
  return clean || url;
}

export class BrasilHentaiExtension implements ExtensionImpl<typeof BrasilHentaiConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 3,
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
        id: "updates",
        title: "Últimos Lançamentos",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "colorido",
        title: "Mangás Coloridos",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "3d",
        title: "Hentai 3D",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    let url: string;
    if (section.id === "colorido") {
      url =
        page === 1
          ? `${BASE_URL}/category/colorido/`
          : `${BASE_URL}/category/colorido/page/${page}/`;
    } else if (section.id === "3d") {
      url =
        page === 1
          ? `${BASE_URL}/category/3d-hentai-hd/`
          : `${BASE_URL}/category/3d-hentai-hd/page/${page}/`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $("article, .type-post, .post").each((_, el) => {
      const titleEl = $(el).find(".entry-title a, .entry-title, h2 a, h1 a, h3 a").first();
      let title = titleEl.text().replace(/\s+/g, " ").trim();
      if (!title) {
        title =
          $(el).find("a[title]").attr("title")?.trim() ||
          $(el).find(".entry-content img[alt]").first().attr("alt")?.trim() ||
          "";
      }

      const href =
        titleEl.attr("href") ||
        $(el).find(".entry-title a, h2 a, a[rel='bookmark']").first().attr("href") ||
        $(el).find(".blog-item-wrap > a").first().attr("href") ||
        $(el).find("a[href]").first().attr("href");

      if (href && title) {
        const mangaId = extractMangaId(href);

        if (mangaId.includes("category/") || mangaId.includes("page/")) {
          return;
        }

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          const img = getItemImage($, $(el));
          const imageUrl =
            img ||
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

          if (section.id === "colorido") {
            items.push({
              mangaId,
              title,
              imageUrl,
              type: "prominentCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else if (section.id === "3d") {
            items.push({
              mangaId,
              title,
              imageUrl,
              type: "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else {
            items.push({
              mangaId,
              title,
              subtitle: "Completo",
              chapterId: mangaId,
              imageUrl,
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        }
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { category: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<BrasilHentaiSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const category =
      query.metadata?.category && query.metadata.category !== "all" ? query.metadata.category : "";

    let url: string;
    if (title) {
      url =
        page === 1
          ? `${BASE_URL}/?s=${encodeURIComponent(title)}`
          : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(title)}`;
    } else if (category) {
      url =
        page === 1
          ? `${BASE_URL}/category/${encodeURIComponent(category)}/`
          : `${BASE_URL}/category/${encodeURIComponent(category)}/page/${page}/`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("article, .type-post, .post").each((_, el) => {
      const titleEl = $(el).find(".entry-title a, .entry-title, h2 a, h1 a, h3 a").first();
      let mangaTitle = titleEl.text().replace(/\s+/g, " ").trim();
      if (!mangaTitle) {
        mangaTitle =
          $(el).find("a[title]").attr("title")?.trim() ||
          $(el).find(".entry-content img[alt]").first().attr("alt")?.trim() ||
          "";
      }

      const href =
        titleEl.attr("href") ||
        $(el).find(".entry-title a, h2 a, a[rel='bookmark']").first().attr("href") ||
        $(el).find(".blog-item-wrap > a").first().attr("href") ||
        $(el).find("a[href]").first().attr("href");

      if (href && mangaTitle) {
        const mangaId = extractMangaId(href);

        if (mangaId.includes("category/") || mangaId.includes("page/")) {
          return;
        }

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          const img = getItemImage($, $(el));
          items.push({
            mangaId,
            title: mangaTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(mangaTitle) +
                "&background=random",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $(".entry-title, h1").first().text().replace(/\s+/g, " ").trim() ||
      mangaId.replace(/-/g, " ");

    const image = getItemImage($, $("article, .entry-content, body"));
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $(".entry-content p")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(
          (t) =>
            t &&
            !t.includes("Use VPN") &&
            !t.includes("Leia Mais") &&
            !t.includes("New ENGLISH") &&
            !t.includes("Novos PT"),
        )
        .join("\n\n") || "Quadrinho adulto completo.";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $('a[rel="category tag"], a[rel="tag"], a[href*="/category/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g) {
        const id = sanitizeTagId(g);
        if (!seenGenres.has(id)) {
          seenGenres.add(id);
          genres.push({ id, title: g });
        }
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "completed",
        author: "Brasil Hentai",
        tagGroups: [{ id: "genres", title: "Categorias", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: 1,
        title: "Capítulo Completo",
        volume: 0,
        publishDate: new Date(),
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${BASE_URL}/${chapter.chapterId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    $(".entry-content img, article img").each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logotipo") &&
        !src.includes("banner") &&
        !src.includes("gif-icon") &&
        !src.includes("new-gif") &&
        !src.endsWith(".gif") &&
        !seenPages.has(src)
      ) {
        seenPages.add(src);
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
              items: [],
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

export const BrasilHentai = new BrasilHentaiExtension();
