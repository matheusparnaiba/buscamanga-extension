import {
  BasicRateLimiter,
  CookieStorageInterceptor,
  ContentRating,
  DiscoverSectionType,
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
  type Cookie,
  type Request,
  CloudflareError,
} from "@paperback/types";

import { SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

declare const App: any;

export class HipertoonExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 10,
    bufferInterval: 5,
    ignoreImages: true,
  });

  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "memory",
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.mainInterceptor.registerInterceptor();

    const saved = Application.getState("hipertoon_saved_cookies") as
      | Array<{ name: string; value: string; domain?: string; path?: string }>
      | undefined;
    if (Array.isArray(saved)) {
      for (const c of saved) {
        if (c?.name && c?.value) {
          try {
            this.cookieStorageInterceptor.setCookie({
              name: c.name,
              value: c.value,
              domain: c.domain || "hipertoon.com",
              path: c.path || "/",
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            });
          } catch {
            // Ignore any CookieStorageInterceptor issues
          }
        }
      }
    }
  }

  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    await this.handleCloudflareBypass(cookies);
  }

  async cloudflareBypassCompleted(
    request: Request,
    cookies: Cookie[],
    _localStorage: Record<string, string>,
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
      Application.setState(ua, "cf_user_agent");
    }
    await this.handleCloudflareBypass(cookies);
  }

  private async handleCloudflareBypass(cookies: Cookie[]): Promise<void> {
    if (!cookies || !Array.isArray(cookies)) return;

    const cleanCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
    const cookieMap: Record<string, string> = {};

    for (const c of cookies) {
      if (!c || !c.name || !c.value) continue;
      const domain = c.domain ? c.domain.replace(/^https?:\/\//, "") : "hipertoon.com";
      const path = c.path || "/";

      cleanCookies.push({
        name: c.name,
        value: c.value,
        domain,
        path,
      });

      cookieMap[c.name] = c.value;

      try {
        this.cookieStorageInterceptor.setCookie({
          name: c.name,
          value: c.value,
          domain,
          path,
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      } catch {
        // Ignore any CookieStorageInterceptor issues
      }
    }

    if (cleanCookies.length > 0) {
      const headerString = Object.entries(cookieMap)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
      Application.setState(cleanCookies, "hipertoon_saved_cookies");
      Application.setState(headerString, "hipertoon_cookie_header");
    }
  }

  private async getCloudflareResolutionRequest(): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    return {
      url: "https://hipertoon.com/",
      method: "GET",
      headers: {
        "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
        referer: "https://hipertoon.com/",
      },
    };
  }

  private async fetchJson(request: Request): Promise<any> {
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);

    if (
      response.status === 403 ||
      response.status === 503 ||
      data.includes("Just a moment...") ||
      data.includes("_cf_chl_opt") ||
      data.includes("challenges.cloudflare.com")
    ) {
      const resolutionRequest = await this.getCloudflareResolutionRequest();
      throw new CloudflareError(
        resolutionRequest,
        "Proteção Cloudflare ativa no Hipertoon! Toque para resolver.",
      );
    }

    if (data.trim().startsWith("<")) {
      const resolutionRequest = await this.getCloudflareResolutionRequest();
      throw new CloudflareError(
        resolutionRequest,
        "Resposta inesperada do Hipertoon (HTML recebido em vez de JSON). Toque para verificar o Cloudflare no navegador.",
      );
    }

    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      throw new Error("Falha ao converter resposta da API do Hipertoon em JSON.");
    }

    if (json && json.error) {
      throw new Error(
        `Erro na API do Hipertoon: ${json.error?.message || JSON.stringify(json.error)}`,
      );
    }

    return json;
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "updates",
        title: "Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "new",
        title: "Recém Adicionados",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    _metadata: any,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const url =
      "https://hipertoon.com/api/trpc/auth.me,recommendations.trending,recommendations.latestChapters,recommendations.newlyAdded?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%2C%221%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%222%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%223%22%3A%7B%22json%22%3A%7B%22limit%22%3A10%7D%7D%7D";

    const request: Request = {
      url,
      method: "GET",
    };

    const json = await this.fetchJson(request);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      const trending = json[1]?.result?.data?.json || [];
      for (const manga of trending) {
        items.push({
          type: "simpleCarouselItem",
          mangaId: `${manga.id}:${manga.slug}`,
          title: manga.title,
          subtitle: manga.latestChapter ? "Capítulo " + manga.latestChapter.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const latest = json[2]?.result?.data?.json || [];
      for (const manga of latest) {
        const firstCh = manga.chapters?.[0];
        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: `${manga.seriesId}:${manga.seriesSlug}`,
          chapterId:
            firstCh && firstCh.number != null
              ? String(firstCh.number)
              : String(manga.seriesSlug || manga.seriesId || "unknown"),
          title: manga.seriesTitle || "Sem título",
          subtitle: firstCh && firstCh.number != null ? "Capítulo " + firstCh.number : undefined,
          imageUrl:
            manga.seriesCoverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.seriesTitle) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "new") {
      const newlyAdded = json[3]?.result?.data?.json || [];
      for (const manga of newlyAdded) {
        items.push({
          type: "prominentCarouselItem",
          mangaId: `${manga.id}:${manga.slug}`,
          title: manga.title,
          subtitle: manga.latestChapter ? "Capítulo " + manga.latestChapter.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title) +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 0;
    const limit = 30;
    const offset = page * limit;

    const input = {
      "0": {
        json: {
          q: query.title || "",
          sort: "relevance",
          filters: {
            genres: null,
            type: null,
            status: null,
            contentRating: null,
          },
          limit: limit,
          offset: offset,
        },
        meta: {
          values: {
            "filters.genres": ["undefined"],
            "filters.type": ["undefined"],
            "filters.status": ["undefined"],
            "filters.contentRating": ["undefined"],
          },
        },
      },
    };

    const searchUrl = `https://hipertoon.com/api/trpc/search.query?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
    const request: Request = { url: searchUrl, method: "GET" };

    const json = await this.fetchJson(request);

    const hits = json[0]?.result?.data?.json?.hits || [];
    const items: SearchResultItem[] = [];

    for (const manga of hits) {
      items.push({
        mangaId: `${manga.id}:${manga.slug}`,
        title: manga.title,
        imageUrl:
          manga.coverUrl ||
          "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(manga.title) +
            "&background=random",
        contentRating: ContentRating.EVERYONE,
      });
    }

    return {
      items,
      metadata: hits.length === limit ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const [_id, slug] = mangaId.split(":");
    const actualSlug = slug || mangaId;

    const url = `https://hipertoon.com/api/trpc/series.bySlugWithGenres?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { slug: actualSlug } } }))}`;
    const request: Request = { url, method: "GET" };

    const json = await this.fetchJson(request);

    const manga = json[0]?.result?.data?.json;
    if (!manga) throw new Error("Failed to parse Manga Details from Hipertoon API");

    const statusMap: any = {
      releasing: "ONGOING",
      completed: "COMPLETED",
      ongoing: "ONGOING",
    };

    const genres: Tag[] =
      manga.genres
        ?.filter((g: any) => g && g.id != null && g.name != null)
        .map((g: any) => ({ id: String(g.id), title: String(g.name) })) || [];

    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(manga.title || "Manga") +
      "&background=random";
    const thumbnailUrl = manga.coverUrl || fallbackImage;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: manga.title || "Sem título",
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: manga.synopsis || "",
        contentRating: ContentRating.EVERYONE,
        status: statusMap[manga.status] || "UNKNOWN",
        author: manga.authors?.[0] || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: manga.coverUrl ? [manga.coverUrl] : [thumbnailUrl],
        shareUrl: `https://hipertoon.com/manga/${actualSlug}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const [id, _slug] = sourceManga.mangaId.split(":");
    const seriesId = id;

    if (!seriesId) throw new Error("Invalid mangaId format, missing seriesId");

    const url = `https://hipertoon.com/api/trpc/series.chapters?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { seriesId: parseInt(seriesId) } } }))}`;
    const request: Request = { url, method: "GET" };

    const json = await this.fetchJson(request);

    const chaptersData = json[0]?.result?.data?.json || [];
    const chapters: Chapter[] = [];

    for (const ch of chaptersData) {
      if (!ch) continue;
      const num = ch.number != null ? ch.number : 0;
      chapters.push({
        chapterId: String(num),
        sourceManga,
        title: ch.title || "Capítulo " + num,
        chapNum: Number(num) || 0,
        langCode: "PT-BR",
        volume: 0,
      });
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const [_id, slug] = chapter.sourceManga.mangaId.split(":");
    const actualSlug = slug || chapter.sourceManga.mangaId;

    const url = `https://hipertoon.com/api/trpc/reader.chapterPages?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { seriesSlug: actualSlug, chapterNumber: parseFloat(chapter.chapterId) } } }))}`;
    const request: Request = { url, method: "GET" };

    const json = await this.fetchJson(request);

    const pagesData = json[0]?.result?.data?.json || [];
    const pages: string[] = [];

    for (const page of pagesData) {
      if (page.webpUrl) pages.push(page.webpUrl);
      else if (page.avifUrl) pages.push(page.avifUrl);
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
        if (e instanceof CloudflareError) throw e;
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
export const Hipertoon = new HipertoonExtension();
