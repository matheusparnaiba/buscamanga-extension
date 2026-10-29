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
import type { HoraHentaiSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type HoraHentaiConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://horahentai.com";

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

  src = src.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return src;
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

export class HoraHentaiExtension implements ExtensionImpl<typeof HoraHentaiConfig> {
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
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "doujinshi",
        title: "Doujinshis",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "mangas",
        title: "Mangás Hentai",
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
    if (section.id === "popular") {
      url = page === 1 ? `${BASE_URL}/popular/` : `${BASE_URL}/popular/page/${page}/`;
    } else if (section.id === "doujinshi") {
      url =
        page === 1
          ? `${BASE_URL}/category/doujinshi/`
          : `${BASE_URL}/category/doujinshi/page/${page}/`;
    } else if (section.id === "mangas") {
      url =
        page === 1
          ? `${BASE_URL}/category/manga-hentai/`
          : `${BASE_URL}/category/manga-hentai/page/${page}/`;
    } else {
      url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $(".lista li.novo-card-item a.novo-card-link-img, .lista li a").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("horahentai.com")) return;
      if (href.includes("/delivery/") || href.includes("random")) return;

      const title =
        a.attr("title")?.trim() ||
        a.find(".novo-card-titulo").text().trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const img = getImageSrc(a.find("img").first());

      if (title) {
        const mangaId = extractMangaId(href);
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
          } else if (section.id === "doujinshi" || section.id === "mangas") {
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
    query: SearchQuery<HoraHentaiSearchMetadata>,
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

    $(".lista li.novo-card-item a.novo-card-link-img, .lista li a").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      if (href.startsWith("http") && !href.includes("horahentai.com")) return;
      if (href.includes("/delivery/") || href.includes("random")) return;

      const mangaTitle =
        a.attr("title")?.trim() ||
        a.find(".novo-card-titulo").text().trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const img = getImageSrc(a.find("img").first());

      if (mangaTitle) {
        const mangaId = extractMangaId(href);
        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
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
      $("h1.post-titulo").first().text().replace(/\s+/g, " ").trim() ||
      $("h1").first().text().replace(/\s+/g, " ").trim() ||
      mangaId.replace(/-/g, " ");

    const image = getImageSrc($(".post-capa img, .capa img, img.wp-post-image, img").first());
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $("h1.post-titulo + .form-group, .post-texto p, .post-texto").first().text().trim() ||
      "Obra completa disponível no Hora Hentai.";

    const author =
      $("ul.post-itens li:contains('Autor') a, ul.post-itens li:contains('Artista') a")
        .first()
        .text()
        .trim() || "Hora Hentai";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $(
      "ul.post-itens a[href*='/category/'] .postTagNome, " +
        "ul.post-itens a[href*='/tag/'] .postTagNome, " +
        "ul.post-itens a[href*='/category/'], " +
        "ul.post-itens a[href*='/tag/']",
    ).each((_, el) => {
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
        author,
        tagGroups: [{ id: "genres", title: "Tags", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/${sourceManga.mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const chapters: Chapter[] = [];
    const galleries = $("div.galeriaTabItem");

    if (galleries.length > 0) {
      galleries.each((i, el) => {
        const galConteudo = $(el).find("div.galeriaConteudo[id^=galeria-]");
        const galleryId = galConteudo.attr("id") || $(el).attr("id") || `galeria-${i + 1}`;

        const label = $(el).find(".galeriaTabCapitulo").text().trim();
        const capTitle = $(el).find(".galeriaTabTitulo").text().trim();

        let chapterName = `Capítulo ${i + 1}`;
        if (label && capTitle) {
          chapterName = `${label}: ${capTitle}`;
        } else if (label) {
          chapterName = label;
        } else if (capTitle) {
          chapterName = capTitle;
        }

        chapters.push({
          chapterId: `${sourceManga.mangaId}#${galleryId}`,
          sourceManga,
          langCode: "PT-BR",
          chapNum: i + 1,
          title: chapterName,
          volume: 0,
          publishDate: new Date(),
        });
      });
    }

    if (chapters.length === 0) {
      chapters.push({
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: 1,
        title: "Capítulo Único",
        volume: 0,
        publishDate: new Date(),
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const baseSlug = chapter.chapterId.includes("#")
      ? chapter.chapterId.split("#")[0]
      : chapter.chapterId;
    const galleryId = chapter.chapterId.includes("#") ? chapter.chapterId.split("#")[1] : "";

    const url = `${BASE_URL}/${baseSlug}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    let selector = "ul.post-fotos li img, .galeriaConteudo img, div.post-box img";
    if (galleryId) {
      selector = `div.galeriaConteudo#${galleryId} img, div#${galleryId} img`;
    }

    $(selector).each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logo") &&
        !src.includes("banner") &&
        !seenPages.has(src)
      ) {
        seenPages.add(src);
        pages.push(src);
      }
    });

    // Fallback if galleryId selector returned nothing
    if (pages.length === 0) {
      $("ul.post-fotos li img, .galeriaConteudo img, div.post-box img").each((_, el) => {
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

export const HoraHentai = new HoraHentaiExtension();
