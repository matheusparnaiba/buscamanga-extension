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
import type { BlackoutComicsSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type BlackoutComicsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://blackoutcomics.com";

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

export class BlackoutComicsExtension implements ExtensionImpl<typeof BlackoutComicsConfig> {
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
        id: "ranking",
        title: "Ranking / Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "adulto",
        title: "Pornhwas Adultos",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "completos",
        title: "Comics Completos",
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
    if (section.id === "ranking") {
      url = `${BASE_URL}/ranking`;
    } else if (section.id === "adulto") {
      url = `${BASE_URL}/comics?gen=Adulto&page=${page}`;
    } else if (section.id === "completos") {
      url = `${BASE_URL}/comics?status=completed&page=${page}`;
    } else {
      url = `${BASE_URL}/atualizados-recente?page=${page}`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $(".webtoon-grid a.webtoon-card, .ranking-grid a.webtoon-card, a.webtoon-card").each(
      (_, el) => {
        const a = $(el);
        const href = a.attr("href");
        if (!href) return;

        const title =
          a.find(".card-title span").text().trim() ||
          a.find(".card-title").text().trim() ||
          a.find("h3, h2").text().trim() ||
          a.text().replace(/\s+/g, " ").trim();
        const img = getImageSrc(a.find(".card-thumb img, img").first());
        const subtitle =
          a.find(".card-bottom, .card-episodes").text().replace(/\s+/g, " ").trim() || undefined;

        if (title) {
          const mangaId = extractMangaId(href);
          if (!seenIds.has(mangaId)) {
            seenIds.add(mangaId);

            if (section.id === "ranking") {
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
            } else if (section.id === "adulto" || section.id === "completos") {
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
                subtitle: subtitle || "Capítulo recente",
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
      },
    );

    const hasNext =
      section.id === "ranking"
        ? false
        : $(".pagerx__link[rel=next], .pagination .next, a.next").length > 0 || items.length >= 20;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { genre: "all", status: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<BlackoutComicsSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";

    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    // If query has text, try preview search first
    if (title) {
      try {
        const previewUrl = `${BASE_URL}/comics/search-preview`;
        const postRequest = {
          url: previewUrl,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-requested-with": "XMLHttpRequest",
          },
          body: JSON.stringify({ src: title }),
        };
        const [_, buffer] = await Application.scheduleRequest(postRequest);
        const text = Application.arrayBufferToUTF8String(buffer);
        if (text && text.trim().startsWith("{")) {
          const parsed = JSON.parse(text) as {
            items?: Array<{
              PJT_ID: number | string;
              PJT_NAME: string;
              PJT_IMG_PR?: string;
              PJT_IMG_PR_URL?: string;
            }>;
          };
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            for (const item of parsed.items) {
              const mangaId = `comics/${item.PJT_ID}`;
              const mangaTitle = item.PJT_NAME;
              const imageUrl =
                item.PJT_IMG_PR_URL ||
                (item.PJT_IMG_PR ? `${BASE_URL}/${item.PJT_IMG_PR}` : "") ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(mangaTitle)}&background=random`;

              if (!seenIds.has(mangaId)) {
                seenIds.add(mangaId);
                items.push({
                  mangaId,
                  title: mangaTitle,
                  imageUrl,
                  contentRating: ContentRating.EVERYONE,
                });
              }
            }
            return { items, metadata: undefined };
          }
        }
      } catch {
        // Fall back to standard search query if preview fails
      }
    }

    // Standard HTML search
    const url = new URL(`${BASE_URL}/comics`);
    if (page > 1) url.searchParams.set("page", String(page));
    if (title) url.searchParams.set("s", title);
    if (genre) url.searchParams.set("gen", genre);
    if (status) url.searchParams.set("status", status);

    const request = { url: url.toString(), method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    $(".webtoon-grid a.webtoon-card, a.webtoon-card").each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      const mangaTitle =
        a.find(".card-title span").text().trim() ||
        a.find(".card-title").text().trim() ||
        a.find("h3, h2").text().trim() ||
        a.text().replace(/\s+/g, " ").trim();
      const img = getImageSrc(a.find(".card-thumb img, img").first());

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

    const hasNext =
      $(".pagerx__link[rel=next], .pagination .next, a.next").length > 0 || items.length >= 20;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const cleanId = extractMangaId(mangaId);
    const url = `${BASE_URL}/${cleanId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $(".project-title, h1").first().text().replace(/\s+/g, " ").trim() ||
      cleanId.replace(/-/g, " ");

    const image = getImageSrc($(".project-cover, .project-thumb img, img").first());
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const author =
      $(".quick-info-item:has(.fa-pen-nib) strong, .author strong, .author")
        .first()
        .text()
        .trim() || "Blackout Comics";

    const synopsis =
      $(".project-description, .description, p").first().text().trim() ||
      "Webtoon adulto disponível no Blackout Comics.";

    const statusText = $(".status-pill").text().toLowerCase();
    const status = statusText.includes("lançamento") ? "ongoing" : "completed";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $(".project-genres .genre-tag, .genre-tag, a[href*='/genre/']").each((_, el) => {
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
      mangaId: cleanId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const cleanId = extractMangaId(sourceManga.mangaId);
    const url = `${BASE_URL}/${cleanId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const chapters: Chapter[] = [];
    const seenChapterIds = new Set<string>();

    $("#tab-capitulos-list .normal_ep, #tab-capitulos-list li, .chapter-list li, .normal_ep").each(
      (i, el) => {
        const item = $(el);
        const link = item.find("a[href]").first();
        const numText = item.find(".num").text().trim();
        const num = parseFloat(numText) || i + 1;

        let chapterUrl = link.attr("href") || "";
        if (!chapterUrl) {
          chapterUrl = `${cleanId}/ler/capitulo-${num}`;
        }
        const chapterId = extractMangaId(chapterUrl);

        if (!seenChapterIds.has(chapterId)) {
          seenChapterIds.add(chapterId);

          let chapterName = `Capítulo ${num}`;
          const subTitle = item.find(".cell-title strong.line-3, .cell-title").text().trim();
          if (subTitle) {
            chapterName += ` - ${subTitle}`;
          }

          chapters.push({
            chapterId,
            sourceManga,
            langCode: "PT-BR",
            chapNum: num,
            title: chapterName,
            volume: 0,
            publishDate: new Date(),
          });
        }
      },
    );

    if (chapters.length === 0) {
      chapters.push({
        chapterId: `${cleanId}/ler/capitulo-1`,
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
    const cleanChapterId = extractMangaId(chapter.chapterId);
    const url = `${BASE_URL}/${cleanChapterId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    // 1. Try script tag parsing for var S = [...]
    $("script:not([src])").each((_, el) => {
      const scriptHtml = $(el).html() || "";
      const match = scriptHtml.match(/S\s*=\s*(\[[^\]]*\])/);
      if (match && match[1]) {
        try {
          const list = JSON.parse(match[1]) as string[];
          if (Array.isArray(list)) {
            for (let pageUrl of list) {
              if (pageUrl && typeof pageUrl === "string") {
                if (!pageUrl.startsWith("http")) {
                  pageUrl = BASE_URL + (pageUrl.startsWith("/") ? "" : "/") + pageUrl;
                }
                if (!seenPages.has(pageUrl)) {
                  seenPages.add(pageUrl);
                  pages.push(pageUrl);
                }
              }
            }
          }
        } catch {
          // ignore json parse error
        }
      }
    });

    // 2. Fallback to image elements
    if (pages.length === 0) {
      $(
        ".chapter-images img, .reading-content img, .reader-area img, div.read-content img, .reading-content-wrap img",
      ).each((_, el) => {
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

export const BlackoutComics = new BlackoutComicsExtension();
