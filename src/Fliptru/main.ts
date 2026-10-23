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
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://fliptru.com.br";

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

export class FliptruExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

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

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Todas as Obras / Lançamentos",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if (section.id === "popular") {
      if (page > 1) return { items: [], metadata: undefined };

      const request = {
        url: `${BASE_URL}/most_popular_list/`,
        method: "GET",
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(data);
      const items: DiscoverSectionItem[] = [];
      const seen = new Set<string>();

      $('a.comic-card[href^="/comic/"]').each((_, el) => {
        const href = $(el).attr("href")?.split("?")[0] || "";
        const slug = href.replace("/comic/", "").replace(/\/+$/, "");
        const title = $(el).attr("data-title") || $(el).find("h3").text().trim() || slug;

        const style = $(el).attr("style") || "";
        const thumbMatch = style.match(/url\((https?:\/\/[^)]+)\)/);
        const img = thumbMatch ? thumbMatch[1] : $(el).find("img").attr("src");

        if (slug && !seen.has(slug)) {
          seen.add(slug);
          items.push({
            mangaId: slug,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });

      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const url = page === 1 ? `${BASE_URL}/comics/all` : `${BASE_URL}/comics/all?page=${page}`;
      const request = { url, method: "GET" };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(data);
      const items: DiscoverSectionItem[] = [];
      const seen = new Set<string>();

      $('a.comic-card[href^="/comic/"]').each((_, el) => {
        const href = $(el).attr("href")?.split("?")[0] || "";
        const slug = href.replace("/comic/", "").replace(/\/+$/, "");
        const title = $(el).attr("data-title") || $(el).find("h3").text().trim() || slug;

        const style = $(el).attr("style") || "";
        const thumbMatch = style.match(/url\((https?:\/\/[^)]+)\)/);
        const img = thumbMatch ? thumbMatch[1] : $(el).find("img").attr("src");

        if (slug && !seen.has(slug)) {
          seen.add(slug);
          items.push({
            mangaId: slug,
            chapterId: slug,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });

      const hasNext = $("#loadMoreComics a").length > 0 || items.length >= 12;

      return {
        items,
        metadata: hasNext ? page + 1 : undefined,
      };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "all" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const orderBy = query.metadata?.orderBy ?? "all";

    if (query.title && query.title.trim()) {
      if (page > 1) return { items: [], metadata: undefined };

      const request = {
        url: `${BASE_URL}/search/?term=${encodeURIComponent(query.title.trim())}`,
        method: "GET",
      };

      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);

      let results: any[] = [];
      try {
        results = JSON.parse(data);
      } catch (e) {
        console.error("Erro ao converter resultado da busca do Fliptru:", e);
      }

      const items: SearchResultItem[] = [];
      for (const res of results) {
        if (!res) continue;
        const rawUrl = (String(res.url || "").split("?")[0] || "").replace(/\/info$/, "");
        if (!rawUrl.startsWith("/comic/")) continue;
        const slug = rawUrl.replace("/comic/", "").replace(/\/+$/, "");
        const rawLabel = String(res.label || "");
        const split = rawLabel.split(" - @");
        const title = rawLabel.includes(" - @") ? (split[0] ?? "").trim() || slug : rawLabel;

        items.push({
          mangaId: slug,
          title,
          imageUrl:
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }

      return { items, metadata: undefined };
    }

    // Default browse
    if (orderBy === "popular" && page > 1) {
      return { items: [], metadata: undefined };
    }

    const url =
      orderBy === "popular"
        ? `${BASE_URL}/most_popular_list/`
        : page === 1
          ? `${BASE_URL}/comics/all`
          : `${BASE_URL}/comics/all?page=${page}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seen = new Set<string>();

    $('a.comic-card[href^="/comic/"]').each((_, el) => {
      const href = $(el).attr("href")?.split("?")[0] || "";
      const slug = href.replace("/comic/", "").replace(/\/+$/, "");
      const title = $(el).attr("data-title") || $(el).find("h3").text().trim() || slug;

      const style = $(el).attr("style") || "";
      const thumbMatch = style.match(/url\((https?:\/\/[^)]+)\)/);
      const img = thumbMatch ? thumbMatch[1] : $(el).find("img").attr("src");

      if (slug && !seen.has(slug)) {
        seen.add(slug);
        items.push({
          mangaId: slug,
          title,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
    });

    const hasNext = $("#loadMoreComics a").length > 0 || items.length >= 12;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId;
    const url = `${BASE_URL}/comic/${slug}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title = $("h1").first().text().trim() || slug;
    const synopsis =
      $('meta[property="og:description"]').attr("content") ||
      $(".comic-synopsis, .synopsis").first().text().trim() ||
      "";

    const rawImage =
      $('meta[property="og:image"]').attr("content") ||
      $(".comic-cover img, .cover img").attr("src");

    const thumbnailUrl =
      rawImage && rawImage.startsWith("http")
        ? rawImage
        : "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    let author = "Desconhecido";
    const authorEl = $('a[href*="/user/"], a[href*="/@"], .comic-author, .author-name').first();
    if (authorEl.length) {
      author = authorEl.text().replace(/^@/, "").trim() || author;
    }

    const genres: Tag[] = [];
    $('a[href*="/category/"], .comic-tags a').each((_, el) => {
      const g = $(el).text().trim();
      if (g) {
        genres.push({ id: sanitizeTagId(g), title: g });
      }
    });

    return {
      mangaId: slug,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: "ONGOING",
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId;
    const url = `${BASE_URL}/comic/${slug}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const chapters: Chapter[] = [];
    const seen = new Set<string>();

    $(
      "#chapterListContainer .chapter-list-item a[href], .chapter-list-item a[href], a[href*='/comic/" +
        slug +
        "/']",
    ).each((_, el) => {
      const href = $(el).attr("href")?.split("?")[0] || "";
      if (!href || href === `/comic/${slug}` || href.endsWith("/info")) return;

      const chapMatch = href.match(/\/comic\/[^/]+\/([^/?#]+)/);
      if (!chapMatch) return;

      const chapSlug = chapMatch[1] as string;
      const name = $(el).text().trim() || `Capítulo ${chapSlug}`;
      const numMatch = chapSlug.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

      if (!seen.has(href)) {
        seen.add(href);
        chapters.push({
          chapterId: href,
          sourceManga,
          langCode: "PT-BR",
          chapNum,
          title: name,
          volume: 0,
        });
      }
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const rawPath = chapter.chapterId;
    const url = rawPath.startsWith("http")
      ? rawPath
      : `${BASE_URL}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seen = new Set<string>();

    $("div.comic_page_image img, .comic-page img, img.page-image, img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (
        src &&
        src.startsWith("http") &&
        (src.includes("comic") || src.includes("page") || src.includes("media.fliptru"))
      ) {
        if (!seen.has(src)) {
          seen.add(src);
          pages.push(src);
        }
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

export const Fliptru = new FliptruExtension();
