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

const API_BASE = "https://api.leituramanga.net";
const SITE_BASE = "https://leituramanga.net";
const CDN_BASE = "https://cdn.leituramanga.net";

function cleanJson(body: string): any {
  const cleaned = body
    .replace(/^[\uFEFF\s]+/, "")
    .replace(/^\)]}'/, "")
    .replace(/^[,_]/, "")
    .trim();
  return JSON.parse(cleaned);
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

export class LeituraMangaExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
    bufferInterval: 5,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  private mangaIdCache = new Map<string, string>();

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
        title: "Mais Lidos (Populares)",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const sortParam = section.id === "popular" ? "view" : "time";

    const request = {
      url: `${API_BASE}/api/manga/?sort=${sortParam}&limit=24&page=${page}`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);

    const items: DiscoverSectionItem[] = [];
    const list = json.data?.data || [];
    const pagination = json.data?.pagination;

    for (const item of list) {
      const slug = item.slug;
      if (!slug) continue;

      if (item._id) {
        this.mangaIdCache.set(slug, String(item._id));
      }

      const title = item.title || slug;
      const imageUrl = `${CDN_BASE}/${slug}/cover-md.webp`;
      const isAdult = item.genres?.some((g: any) => g.isAdult);

      if (section.id === "popular") {
        items.push({
          mangaId: slug,
          title,
          subtitle: item.genres
            ? item.genres
                .map((g: any) => g.name)
                .slice(0, 2)
                .join(", ")
            : undefined,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
      } else {
        const lastChap = item.chapters?.[0];
        const chapterSubtitle = lastChap ? `Cap. ${lastChap.chapterNumber}` : undefined;

        items.push({
          mangaId: slug,
          chapterId: slug,
          title,
          subtitle: chapterSubtitle,
          imageUrl,
          type: "chapterUpdatesCarouselItem",
          contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
      }
    }

    const hasNext = pagination ? pagination.page < pagination.totalPage : items.length >= 24;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "view" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const orderBy = query.metadata?.orderBy ?? "view";
    let url: string;

    if (query.title && query.title.trim()) {
      url = `${API_BASE}/api/manga/?keyword=${encodeURIComponent(query.title.trim())}&limit=24&page=${page}`;
    } else {
      url = `${API_BASE}/api/manga/?sort=${encodeURIComponent(orderBy)}&limit=24&page=${page}`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);

    const items: SearchResultItem[] = [];
    const list = json.data?.data || [];
    const pagination = json.data?.pagination;

    for (const item of list) {
      const slug = item.slug;
      if (!slug) continue;

      if (item._id) {
        this.mangaIdCache.set(slug, String(item._id));
      }

      const title = item.title || slug;
      const imageUrl = `${CDN_BASE}/${slug}/cover-md.webp`;
      const isAdult = item.genres?.some((g: any) => g.isAdult);

      items.push({
        mangaId: slug,
        title,
        imageUrl,
        contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
      });
    }

    const hasNext = pagination ? pagination.page < pagination.totalPage : items.length >= 24;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId;
    const url = `${SITE_BASE}/manga/${slug}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title = $("h1").first().text().trim() || slug;
    const synopsis =
      $('h2:contains("Sinopse")').next("div").find("p").text().trim() ||
      $("p.text-muted-foreground").first().text().trim() ||
      "";

    const author =
      $('p:contains("Autor")')
        .text()
        .replace(/.*Autor:\s*/i, "")
        .trim() || "Desconhecido";

    const rawCover =
      $('meta[property="og:image"]').attr("content") ||
      $('img[src*="cover"]').attr("src") ||
      `${CDN_BASE}/${slug}/cover-md.webp`;

    const thumbnailUrl = rawCover.startsWith("//") ? "https:" + rawCover : rawCover;

    // Cache mongo ID if present in page
    const mongoMatch = data.match(/mangaId[\\]*":[\\]*"([a-f0-9]{24})/i);
    if (mongoMatch) {
      this.mangaIdCache.set(slug, mongoMatch[1] as string);
    }

    let status = "ONGOING";
    const statusText = $('p:contains("Status")').text().toLowerCase();
    if (statusText.includes("completo")) {
      status = "COMPLETED";
    }

    const genres: Tag[] = [];
    $('a[href*="/genre/"]').each((_, el) => {
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
        status,
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId;
    let mongoId = this.mangaIdCache.get(slug);

    if (!mongoId) {
      try {
        const req = {
          url: `${API_BASE}/api/manga/?keyword=${encodeURIComponent(slug)}`,
          method: "GET",
        };
        const [_, buffer] = await Application.scheduleRequest(req);
        const json = cleanJson(Application.arrayBufferToUTF8String(buffer));
        const found = json.data?.data?.find((m: any) => m.slug === slug) || json.data?.data?.[0];
        if (found?._id) {
          mongoId = String(found._id);
          this.mangaIdCache.set(slug, mongoId);
        }
      } catch (e) {
        console.error("Erro ao resolver mongoId do mangá:", e);
      }
    }

    if (!mongoId) {
      return [];
    }

    const request = {
      url: `${API_BASE}/api/chapter/get-by-manga-id?mangaId=${mongoId}&page=1&limit=9007199254740991`,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const json = cleanJson(data);

    const chapters: Chapter[] = [];
    const list = json.data?.data || [];

    for (const item of list) {
      const num = item.chapterNumber;
      const title = item.title || `Capítulo ${num}`;
      const chapterId = `${slug}:::${num}`;

      let publishDate: Date | undefined;
      const rawDate = item.releaseDate || item.createdAt || item.updatedAt || item.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) publishDate = d;
      }

      chapters.push({
        chapterId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: typeof num === "number" ? num : parseFloat(String(num)) || 0,
        title,
        volume: 0,
        publishDate,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const rawId = chapter.chapterId;
    let slug = chapter.sourceManga.mangaId;
    let chapterNum = "";

    if (rawId.includes(":::")) {
      const parts = rawId.split(":::");
      slug = parts[0] as string;
      chapterNum = parts[1] as string;
    } else {
      chapterNum = rawId;
    }

    const url = `${SITE_BASE}/manga/${slug}/chapter/${chapterNum}`;
    const request = {
      url,
      method: "GET",
      headers: {
        RSC: "1",
      },
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const text = Application.arrayBufferToUTF8String(buffer);

    const pages: string[] = [];
    const match = text.match(/"images":\s*(\[[^\]]+\])/);

    if (match) {
      try {
        const rawImages = JSON.parse(match[1] as string);
        for (const img of rawImages) {
          if (img.url) {
            const fullUrl = img.url.startsWith("http")
              ? img.url
              : `${CDN_BASE}/${img.url.replace(/^\/+/, "")}`;
            pages.push(fullUrl);
          }
        }
      } catch (err) {
        console.error("Erro ao deserializar images do capítulo:", err);
      }
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

export const LeituraManga = new LeituraMangaExtension();
