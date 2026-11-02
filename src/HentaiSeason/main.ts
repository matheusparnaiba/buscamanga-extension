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
import type { HentaiSeasonSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type HentaiSeasonConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://hentaiseason.com";

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
  const clean = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+|\/+$/g, "");
  return clean || url;
}

export class HentaiSeasonExtension implements ExtensionImpl<typeof HentaiSeasonConfig> {
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { category: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Últimos Lançamentos",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "doujinshi",
        title: "Doujinshis",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "pack-imagens",
        title: "Packs de Imagens",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "oneshot",
        title: "One-Shots",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "peitao",
        title: "Peitão",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "bundao",
        title: "Bundão",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "creampie",
        title: "Creampie",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "milf",
        title: "Milf",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "dupla-penetracao",
        title: "Dupla Penetração",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "ahegao",
        title: "Ahegão",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "anal",
        title: "Anal",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "incesto",
        title: "Incesto",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "oral",
        title: "Oral",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "grupal",
        title: "Grupal",
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
    if (section.id === "doujinshi") {
      url =
        page === 1
          ? `${BASE_URL}/category/doujinshi/`
          : `${BASE_URL}/category/doujinshi/page/${page}/`;
    } else if (section.id === "oneshot" || section.id === "one-shot") {
      url =
        page === 1
          ? `${BASE_URL}/category/one-shot/`
          : `${BASE_URL}/category/one-shot/page/${page}/`;
    } else if (section.id === "pack-imagens") {
      url =
        page === 1
          ? `${BASE_URL}/category/pack-imagens/`
          : `${BASE_URL}/category/pack-imagens/page/${page}/`;
    } else if (section.id === "updates") {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    } else {
      url =
        page === 1
          ? `${BASE_URL}/tag/${section.id}/`
          : `${BASE_URL}/tag/${section.id}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $("div.thumb-conteudo a, div.meio div.lista ul li a, .lista li a").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("hentaiseason.com")) return;
      if (href.includes("/delivery/") || href.includes("random")) return;

      const title =
        a.find(".thumb-titulo").text().trim() ||
        a.attr("title")?.trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const img = getImageSrc(a.find("img").first());

      if (title) {
        const mangaId = extractMangaId(href);
        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);

          if (section.id === "doujinshi") {
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
          } else if (section.type === DiscoverSectionType.chapterUpdates) {
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
          } else {
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
          }
        }
      }
    });

    const hasNextPage =
      $("ul.paginacao li.next a, a:contains('Próxima página'), a.next").length > 0;

    return {
      items,
      metadata: hasNextPage ? page + 1 : undefined,
    };
  }

  async getSearchResults(
    query: SearchQuery<HentaiSeasonSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    let category = query.metadata?.category || "all";
    const title = query.title?.trim();

    let url: string;
    if (category && category !== "all") {
      let isCategory = false;
      let slug = category;

      if (slug.startsWith("category:")) {
        isCategory = true;
        slug = slug.replace("category:", "");
      } else if (slug.startsWith("tag:")) {
        isCategory = false;
        slug = slug.replace("tag:", "");
      } else if (slug === "doujinshi" || slug === "one-shot" || slug === "pack-imagens") {
        isCategory = true;
      }

      const prefix = isCategory ? "category" : "tag";
      url =
        page === 1
          ? `${BASE_URL}/${prefix}/${slug}/`
          : `${BASE_URL}/${prefix}/${slug}/page/${page}/`;
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

    $("div.thumb-conteudo a, div.meio div.lista ul li a, .lista li a").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("hentaiseason.com")) return;
      if (href.includes("/delivery/") || href.includes("random")) return;

      const cardTitle =
        a.find(".thumb-titulo").text().trim() ||
        a.attr("title")?.trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const img = getImageSrc(a.find("img").first());

      if (cardTitle) {
        const mangaId = extractMangaId(href);
        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: cardTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(cardTitle) +
                "&background=random",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }
    });

    const hasNextPage =
      $("ul.paginacao li.next a, a:contains('Próxima página'), a.next").length > 0;

    return {
      items,
      metadata: hasNextPage ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const postBox = $("div.meio div.post-box, div.post-box, article").first();

    const title =
      postBox.find("h1.post-titulo").first().text().replace(/\s+/g, " ").trim() ||
      $("h1").first().text().replace(/\s+/g, " ").trim() ||
      mangaId.replace(/-/g, " ");

    const image = getImageSrc(
      postBox
        .find("div.post-capa img.wp-post-image, div.post-capa img, img.wp-post-image, img")
        .first(),
    );
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      postBox
        .find("div.post-texto p")
        .map((_, el) => $(el).text())
        .get()
        .join("\n\n")
        .replace(/Sinopse\s*:/i, "")
        .trim() || "Doujinshi completo.";

    const author =
      postBox
        .find(
          "ul.post-itens li:contains('Estúdio') a, ul.post-itens li:contains('Artista') a, ul.post-itens li:contains('Autor') a, ul.post-itens li:contains('Tradutor') a",
        )
        .first()
        .text()
        .trim() || "Hentai Season";

    const parodia = postBox.find("ul.post-itens li:contains('Paródia') a").first().text().trim();

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    postBox
      .find(
        "ul.post-itens a[href*='/tag/'], ul.post-itens a[href*='/category/'], a[href*='/tag/'], a[href*='/category/']",
      )
      .each((_, el) => {
        const g = $(el).text().trim();
        if (
          g &&
          ![
            "Início",
            "Comissões",
            "Hentai da Sorte",
            "Pack Imagens",
            "Doujinshi",
            "One-shot",
          ].includes(g)
        ) {
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
        secondaryTitles: parodia ? [`Paródia: ${parodia}`] : [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "completed",
        author,
        tagGroups: genres.length > 0 ? [{ id: "genres", title: "Tags", tags: genres }] : [],
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
    const url = `${BASE_URL}/${chapter.chapterId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    $(
      "ul.post-fotos li img, div.galeriaHtml img, div.post-fotos img, ul.post-fotos a > img, " +
        "div.meio div.post-box ul.post-fotos li a > img, div.meio div.post-box.listaImagens div.galeriaHtml img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logo") &&
        !src.includes("banner") &&
        !src.includes("avatar") &&
        !src.includes("carregando.gif") &&
        !src.includes("adblock") &&
        !seenPages.has(src)
      ) {
        seenPages.add(src);
        pages.push(src);
      }
    });

    if (pages.length === 0) {
      $("div.meio div.post-box img").each((_, el) => {
        const src = getImageSrc($(el));
        if (
          src &&
          src.startsWith("http") &&
          !src.includes("logo") &&
          !src.includes("banner") &&
          !src.includes("avatar") &&
          !src.includes("carregando.gif") &&
          !src.includes("adblock") &&
          !seenPages.has(src)
        ) {
          seenPages.add(src);
          pages.push(src);
        }
      });
    }

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

export const HentaiSeason = new HentaiSeasonExtension();
