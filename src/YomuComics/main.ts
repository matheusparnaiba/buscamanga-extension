/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  CloudflareError,
  ContentRating,
  DiscoverSectionType,
  type AdvancedSearchForm,
  type Chapter,
  type ChapterDetails,
  type Cookie,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type Form,
  type PagedResults,
  type Request,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  YomuChaptersResponse,
  YomuDetailsResponse,
  YomuLatestResponse,
  YomuSearchMetadata,
  YomuSearchResponse,
} from "./models";
import { MainInterceptor } from "./network";
import type YomuComicsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://yomumangas.com";

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-zA-Z0-9._\-@()[\]%?#+=/&:]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}
const API_URL = "https://api.yomumangas.com";
const B2_URL = "https://b2.yomumangas.com/";

function replaceB2Uri(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("b2://")) {
    return uri.replace("b2://", B2_URL);
  }
  if (uri.startsWith("//")) return "https:" + uri;
  if (uri.startsWith("/")) return BASE_URL + uri;
  return uri;
}

function parseMangaIdentifier(rawId: string): { id: string; slug: string } {
  if (rawId.includes("#")) {
    const parts = rawId.split("#");
    return { id: parts[0] ?? rawId, slug: parts[1] ?? "" };
  }
  return { id: rawId, slug: "" };
}

export class YomuComicsExtension implements ExtensionImpl<typeof YomuComicsConfig> {
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

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    await this.handleCloudflareBypass(cookies);
  }

  async cloudflareBypassCompleted(
    request?: Request,
    cookies?: Cookie[],
    _localStorage?: Record<string, string>,
  ): Promise<void> {
    let ua: string | undefined = undefined;
    if (request?.headers) {
      for (const key of Object.keys(request.headers)) {
        if (key.toLowerCase() === "user-agent") {
          ua = request.headers[key];
          break;
        }
      }
    }
    if (ua && typeof ua === "string") {
      Application.setState(ua, "yomu_cf_user_agent");
    }
    if (cookies) {
      await this.handleCloudflareBypass(cookies);
    }
  }

  private async handleCloudflareBypass(cookies: Cookie[]): Promise<void> {
    if (!cookies || !Array.isArray(cookies)) return;

    const cleanCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
    const headerParts: string[] = [];

    for (const c of cookies) {
      if (!c || !c.name || !c.value) continue;
      const rawDomain = c.domain ? c.domain.replace(/^https?:\/\//, "") : "yomumangas.com";
      const cleanDomain = rawDomain.replace(/^\./, "");
      const path = c.path || "/";

      cleanCookies.push({
        name: c.name,
        value: c.value,
        domain: cleanDomain,
        path,
      });

      headerParts.push(`${c.name}=${c.value}`);
    }

    if (cleanCookies.length > 0) {
      Application.setState(cleanCookies, "yomu_saved_cookies");
      Application.setState(headerParts.join("; "), "yomu_cookie_header");
    }
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if (section.id === "popular") {
      const url = `${API_URL}/search/medias?page=${page}`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const response: YomuSearchResponse = JSON.parse(data);

      const items: DiscoverSectionItem[] = (response.mangas ?? []).map((m) => {
        const mangaId = `${m.id}#${m.slug}`;
        const cover = replaceB2Uri(m.cover);
        return {
          mangaId,
          title: m.title,
          imageUrl:
            cover ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(m.title)}&background=random`,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        };
      });

      return {
        items,
        metadata: page < (response.pages ?? 1) ? page + 1 : undefined,
      };
    }

    if (section.id === "updates") {
      const url = `${API_URL}/home/updates?page=${page}`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      const response: YomuLatestResponse = JSON.parse(data);

      const items: DiscoverSectionItem[] = (response.medias ?? []).map((m) => {
        const mangaId = `${m.id}#${m.slug}`;
        const cover = replaceB2Uri(m.cover);
        const latestChap = (m as any).chapters?.last?.chapter;
        const subtitle = latestChap ? `Capítulo ${latestChap}` : undefined;

        return {
          mangaId,
          chapterId: mangaId,
          title: m.title,
          subtitle,
          imageUrl:
            cover ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(m.title)}&background=random`,
          type: "chapterUpdatesCarouselItem",
          contentRating: ContentRating.EVERYONE,
        };
      });

      return {
        items,
        metadata: page < 20 && items.length > 0 ? page + 1 : undefined,
      };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { type: "all", status: "all", nsfw: "all" },
    });
  }

  async getSearchResults(
    query: SearchQuery<YomuSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const type = query.metadata?.type && query.metadata.type !== "all" ? query.metadata.type : "";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const nsfw = query.metadata?.nsfw && query.metadata.nsfw !== "all" ? query.metadata.nsfw : "";

    const urlParams: string[] = [`page=${page}`];
    if (title) urlParams.push(`q=${encodeURIComponent(title)}`);
    if (type) urlParams.push(`type=${encodeURIComponent(type)}`);
    if (status) urlParams.push(`status=${encodeURIComponent(status)}`);
    if (nsfw) urlParams.push(`nsfw=${encodeURIComponent(nsfw)}`);

    const url = `${API_URL}/search/medias?${urlParams.join("&")}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const response: YomuSearchResponse = JSON.parse(data);

    const items: SearchResultItem[] = (response.mangas ?? []).map((m) => {
      const mangaId = `${m.id}#${m.slug}`;
      const cover = replaceB2Uri(m.cover);
      return {
        mangaId,
        title: m.title,
        imageUrl:
          cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(m.title)}&background=random`,
        contentRating: ContentRating.EVERYONE,
      };
    });

    return {
      items,
      metadata: page < (response.pages ?? 1) ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const { id, slug } = parseMangaIdentifier(mangaId);
    const url = `${API_URL}/mangas/${id}`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const response: YomuDetailsResponse = JSON.parse(data);
    const m = response.manga;

    const title = m.title || "Obra";
    const image = replaceB2Uri(m.cover);
    const thumbnailUrl =
      image || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    let status = "ongoing";
    if (m.status === "COMPLETE") status = "completed";
    else if (m.status === "HIATUS") status = "hiatus";
    else if (m.status === "CANCELLED") status = "cancelled";

    const authors = m.authors?.join(", ") || "";
    const artists = m.artists?.join(", ") || "";
    const author = authors || artists || "Desconhecido";

    const tagList = [...(m.genres ?? []), ...(m.tags ?? [])];
    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    for (const t of tagList) {
      if (t.name && !seenGenres.has(t.name)) {
        seenGenres.add(t.name);
        genres.push({
          id: sanitizeTagId(t.name),
          title: t.name,
        });
      }
    }

    const shareUrl = `${BASE_URL}/mangas/${id}/${slug || m.slug}`;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: m.description || "",
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Gêneros e Tags", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const { id, slug } = parseMangaIdentifier(sourceManga.mangaId);
    const url = `${API_URL}/mangas/${id}/chapters`;
    const request = { url, method: "GET" };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const response: YomuChaptersResponse = JSON.parse(data);

    const chapters: Chapter[] = [];
    const chapterList = response.chapters ?? [];

    for (const c of chapterList) {
      const chapterNum = parseFloat(c.chapter) || 0;
      const parsedTitle = c.title?.trim()?.replace(/^-/, "")?.trim();
      const chapterTitle = parsedTitle
        ? `Capítulo ${c.chapter} - ${parsedTitle}`
        : `Capítulo ${c.chapter}`;
      const chapterSlug = slug || "manga";
      const chapterId = `/mangas/${id}/${chapterSlug}/${c.chapter}`;
      const publishDate = c.uploaded_at ? new Date(c.uploaded_at) : undefined;

      chapters.push({
        chapterId,
        sourceManga,
        langCode: "PT-BR",
        chapNum: chapterNum,
        title: chapterTitle,
        volume: c.volume ?? 0,
        publishDate: publishDate && !isNaN(publishDate.getTime()) ? publishDate : undefined,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    let cleanId = chapter.chapterId;
    if (cleanId.includes("//")) {
      cleanId = cleanId.replace(/\/+/g, "/");
    }

    const chapterUrl = cleanId.startsWith("http")
      ? cleanId
      : `${BASE_URL}${cleanId.startsWith("/") ? "" : "/"}${cleanId}`;

    const request = { url: chapterUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const html = Application.arrayBufferToUTF8String(buffer);

    const pages: string[] = [];
    const seen = new Set<string>();

    const b2Regex = /b2:\/\/chapters\/[^"'\\s\s]+/g;
    let match: RegExpExecArray | null;
    while ((match = b2Regex.exec(html)) !== null) {
      const imgUrl = replaceB2Uri(match[0]);
      if (imgUrl && !seen.has(imgUrl)) {
        seen.add(imgUrl);
        pages.push(imgUrl);
      }
    }

    if (pages.length === 0) {
      const directRegex = /https:\/\/b2\.yomumangas\.com\/chapters\/[^"'\\s\s]+/g;
      while ((match = directRegex.exec(html)) !== null) {
        const imgUrl = match[0];
        if (imgUrl && !seen.has(imgUrl)) {
          seen.add(imgUrl);
          pages.push(imgUrl);
        }
      }
    }

    if (pages.length === 0) {
      const $ = cheerio.load(html);
      $(
        'li[data-type="page"] img, div[data-type="page"] img, .reading-content img, .chapter-images img, main img, img',
      ).each((_, el) => {
        const src =
          $(el).attr("src") ||
          $(el).attr("data-src") ||
          $(el).attr("data-original") ||
          $(el).attr("data-lazy-src") ||
          "";
        if (src && !src.startsWith("data:") && !src.includes("avatar") && !src.includes("logo")) {
          const fullSrc = replaceB2Uri(src);
          if (fullSrc && !seen.has(fullSrc)) {
            seen.add(fullSrc);
            pages.push(fullSrc);
          }
        }
      });
    }

    if (pages.length === 0) {
      const isCf =
        html.includes("Just a moment...") ||
        html.includes("_cf_chl_opt") ||
        html.includes("challenges.cloudflare.com") ||
        html.toLowerCase().includes("cloudflare");

      if (isCf) {
        const cfUserAgent = Application.getState("yomu_cf_user_agent") as string | undefined;
        const resolutionRequest: Request = {
          url: chapterUrl,
          method: "GET",
          headers: {
            "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
            referer: `${BASE_URL}/`,
          },
        };
        throw new CloudflareError(
          resolutionRequest,
          "Proteção Cloudflare ativa no Yomu Comics! Toque para resolver.",
        );
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

export const YomuComics = new YomuComicsExtension();
