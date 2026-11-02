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
import type { HentaiDaTiaSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type HentaiDaTiaConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://hentaidatia.com";

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

  return sanitizeImageUrl(src);
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\[\s*Portugu[eê]s\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  return clean || url;
}

export class HentaiDaTiaExtension implements ExtensionImpl<typeof HentaiDaTiaConfig> {
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
        id: "mangas",
        title: "Mangás Hentai",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "colorido",
        title: "Hentais Coloridos",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "parodias",
        title: "Paródias Famosas",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "peitos_grandes",
        title: "Peitos Grandes",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "creampie",
        title: "Creampie",
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
    if (section.id === "mangas") {
      url = page === 1 ? `${BASE_URL}/mangashentai/` : `${BASE_URL}/mangashentai/page/${page}/`;
    } else if (section.id === "popular") {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/tag/peitos-grandes/page/${page}/`;
    } else if (section.id === "colorido") {
      url = page === 1 ? `${BASE_URL}/tag/colorido/` : `${BASE_URL}/tag/colorido/page/${page}/`;
    } else if (section.id === "parodias") {
      url = page === 1 ? `${BASE_URL}/tag/parodia/` : `${BASE_URL}/tag/parodia/page/${page}/`;
    } else if (section.id === "peitos_grandes") {
      url =
        page === 1
          ? `${BASE_URL}/tag/peitos-grandes/`
          : `${BASE_URL}/tag/peitos-grandes/page/${page}/`;
    } else if (section.id === "creampie") {
      url = page === 1 ? `${BASE_URL}/tag/creampie/` : `${BASE_URL}/tag/creampie/page/${page}/`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    let itemSelector =
      "div.mangashentai-card a, div.thumb-conteudo a[title], div.thumb-conteudo a:has(img), .mangashentai-grid a";
    if (page === 1 && section.id === "popular") {
      const popBox = $("div.home-box:contains('Populares')");
      if (popBox.length > 0) {
        itemSelector = "div.home-box:contains('Populares') div.thumb-conteudo a";
      }
    } else if (page === 1 && section.id === "updates") {
      const recBox = $("div.home-box:contains('Recentes')");
      if (recBox.length > 0) {
        itemSelector = "div.home-box:contains('Recentes') div.thumb-conteudo a";
      }
    }

    $(itemSelector).each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("hentaidatia.com")) return;
      if (
        href.includes("/cadastro") ||
        href.includes("/entrar") ||
        href.includes("/contato") ||
        href.includes("/todas-as-tags") ||
        href.includes("/parodias") ||
        href.includes("/galeria")
      ) {
        return;
      }

      const rawTitle =
        a.attr("title")?.trim() ||
        a.find(".thumb-titulo").text().trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const title = cleanTitle(rawTitle);
      const img = getImageSrc(a.find("img").first());

      if (title) {
        const mangaId = extractMangaId(href);
        if (!mangaId || mangaId === "mangashentai") return;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);

          if (section.id === "popular") {
            items.push({
              mangaId,
              title,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
              type: "prominentCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else if (section.id === "colorido" || section.id === "parodias") {
            items.push({
              mangaId,
              title,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
              type: "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else {
            items.push({
              mangaId,
              title,
              subtitle: "Completo",
              chapterId: mangaId,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
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
    query: SearchQuery<HentaiDaTiaSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const category =
      query.metadata?.category && query.metadata.category !== "all" ? query.metadata.category : "";

    let url: string;
    if (category.startsWith("parodia:")) {
      const parodiaSlug = category.replace("parodia:", "");
      url =
        page === 1
          ? `${BASE_URL}/parodia/${parodiaSlug}/`
          : `${BASE_URL}/parodia/${parodiaSlug}/page/${page}/`;
      if (title) {
        url += `?s=${encodeURIComponent(title)}`;
      }
    } else if (category.startsWith("tag:")) {
      const tagSlug = category.replace("tag:", "");
      url = page === 1 ? `${BASE_URL}/tag/${tagSlug}/` : `${BASE_URL}/tag/${tagSlug}/page/${page}/`;
      if (title) {
        url += `?s=${encodeURIComponent(title)}`;
      }
    } else if (title) {
      url =
        page === 1
          ? `${BASE_URL}/?s=${encodeURIComponent(title)}`
          : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(title)}`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("div.thumb-conteudo a[title], div.thumb-conteudo a:has(img)").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("hentaidatia.com")) return;
      if (
        href.includes("/cadastro") ||
        href.includes("/entrar") ||
        href.includes("/contato") ||
        href.includes("/todas-as-tags") ||
        href.includes("/parodias") ||
        href.includes("/galeria")
      ) {
        return;
      }

      const rawTitle =
        a.attr("title")?.trim() ||
        a.find(".thumb-titulo").text().trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const itemTitle = cleanTitle(rawTitle);
      const img = getImageSrc(a.find("img").first());

      if (itemTitle) {
        const mangaId = extractMangaId(href);
        if (!mangaId || mangaId === "mangashentai") return;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: itemTitle,
            subtitle: "Completo",
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(itemTitle) +
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

    const rawTitle =
      $("h1").first().text().replace(/\s+/g, " ").trim() || mangaId.replace(/-/g, " ");
    const title = cleanTitle(rawTitle);

    const image = getImageSrc(
      $(".post-capa img, img.attachment-post-thumbnail, .wp-post-image, ul.post-fotos img").first(),
    );
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $(".post-box p")
        .filter((_, el) => !$(el).text().includes("18 anos") && !$(el).text().includes("direitos"))
        .first()
        .text()
        .trim() || "Obra completa disponível no Hentai da Tia.";

    const author =
      $("a[href*='/autor/']").first().text().trim() ||
      $("a[href*='/artista/']").first().text().trim() ||
      "Hentai da Tia";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $("a[href*='/tag/'], a[href*='/parodia/']").each((_, el) => {
      const g = $(el).text().trim();
      if (g && !g.toLowerCase().includes("obra") && !g.includes("(") && !g.includes(")")) {
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
        author,
        tagGroups: [{ id: "genres", title: "Tags", tags: genres }],
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
        title: "Capítulo Único",
        volume: 0,
        publishDate: new Date(),
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${BASE_URL}/${chapter.sourceManga.mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    $("ul.post-fotos li a img, .post-fotos img, div.post-box img").each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logo") &&
        !src.includes("banner") &&
        !src.includes("avatar") &&
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

export const HentaiDaTia = new HentaiDaTiaExtension();
