import {
  BasicRateLimiter,
  CloudflareError,
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
} from "@paperback/types";

import { decrypt, getParams } from "./decrypt";
import { SettingsForm } from "./forms";
import type { ContentTemplateSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type ContentTemplateConfig from "./pbconfig";

const API_BASE = "https://app.manganyx.com/v1/www";

export class MangaNYXExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
    bufferInterval: 5,
    ignoreImages: true,
  });

  cookieStorageInterceptor = new CookieStorageInterceptor({
    storage: "memory",
  });

  mainInterceptor = new MainInterceptor("main");

  private homePromise?: { promise: Promise<any>; timestamp: number };
  private keyCache: Map<string, string> = new Map();

  private async getCloudflareResolutionRequest(): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    return {
      url: "https://manganyx.com/",
      method: "GET",
      headers: {
        "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
        referer: "https://manganyx.com/",
      },
    };
  }

  private async getKey(v: number, e: number): Promise<string> {
    const cacheKey = `atfield_key_${v}_${e}`;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const savedKey = Application.getState(cacheKey) as string | undefined;
    if (savedKey && typeof savedKey === "string" && savedKey.length > 0) {
      this.keyCache.set(cacheKey, savedKey);
      return savedKey;
    }

    const domains = ["https://manganyx.com", "https://manganyx.org"];

    for (const domain of domains) {
      try {
        const url = `${domain}/api/atfield/key?v=${v}&e=${e}`;
        const request: Request = {
          url,
          method: "GET",
          headers: {
            accept: "application/json, text/plain, */*",
            referer: `${domain}/`,
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
          },
        };

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
            "Proteção Cloudflare ativa no MangaNYX! Toque para resolver.",
          );
        }

        if (response.status === 200 && !data.trim().startsWith("<")) {
          const json = JSON.parse(data);
          if (json.k && typeof json.k === "string") {
            this.keyCache.set(cacheKey, json.k);
            Application.setState(json.k, cacheKey);
            return json.k;
          }
        }
      } catch (err) {
        if (err instanceof CloudflareError) {
          throw err;
        }
      }
    }

    const resolutionRequest = await this.getCloudflareResolutionRequest();
    throw new CloudflareError(
      resolutionRequest,
      "Proteção Cloudflare ativa no MangaNYX! Toque para resolver.",
    );
  }

  private async getHomeData(): Promise<any> {
    const now = Date.now();
    if (this.homePromise && now - this.homePromise.timestamp < 60000) {
      try {
        return await this.homePromise.promise;
      } catch {
        this.homePromise = undefined;
      }
    }

    const fetchPromise = (async () => {
      const request = {
        url: `${API_BASE}/home`,
        method: "GET",
      };
      const [response, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      if (response.status !== 200 || data.trim().startsWith("<")) {
        throw new Error(`Falha ao carregar destaques (HTTP ${response.status})`);
      }
      const parsed = JSON.parse(data);
      return parsed.data || parsed || {};
    })();

    this.homePromise = { promise: fetchPromise, timestamp: now };

    try {
      return await fetchPromise;
    } catch (e) {
      this.homePromise = undefined;
      throw e;
    }
  }

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.cookieStorageInterceptor.registerInterceptor();
    this.mainInterceptor.registerInterceptor();

    const saved = Application.getState("manganyx_saved_cookies") as
      | Array<{ name: string; value: string; domain?: string; path?: string }>
      | undefined;
    if (Array.isArray(saved)) {
      for (const c of saved) {
        if (c?.name && c?.value) {
          try {
            this.cookieStorageInterceptor.setCookie({
              name: c.name,
              value: c.value,
              domain: c.domain || "manganyx.com",
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
    if (request.headers) {
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
    const headerParts: string[] = [];

    for (const c of cookies) {
      if (!c || !c.name || !c.value) continue;
      const domain = c.domain ? c.domain.replace(/^https?:\/\//, "") : "manganyx.com";
      const path = c.path || "/";

      cleanCookies.push({
        name: c.name,
        value: c.value,
        domain,
        path,
      });

      headerParts.push(`${c.name}=${c.value}`);

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
      Application.setState(cleanCookies, "manganyx_saved_cookies");
    }
    if (headerParts.length > 0) {
      Application.setState(headerParts.join("; "), "manganyx_cookie_header");
    }
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "highlights",
        title: "Destaques",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: any,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    if (metadata && (metadata.page > 1 || (typeof metadata === "number" && metadata > 1))) {
      return { items: [], metadata: undefined };
    }

    const homeData = await this.getHomeData();
    const items: DiscoverSectionItem[] = [];

    if (section.id === "highlights") {
      const list = homeData.freeHighlights || homeData.hero || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        items.push({
          type: "prominentCarouselItem",
          mangaId: manga.slug,
          title: manga.title || "Sem título",
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      const list = homeData.recentUpdates || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        const firstCh = manga.recentChapters?.[0];
        const chapterId = firstCh ? String(firstCh.id || firstCh.number || "") : String(manga.slug);

        items.push({
          type: "chapterUpdatesCarouselItem",
          mangaId: manga.slug,
          chapterId: chapterId || manga.slug,
          title: manga.title || "Sem título",
          subtitle: firstCh?.number != null ? "Capítulo " + firstCh.number : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
      return { items, metadata: undefined };
    }

    if (section.id === "popular") {
      const list = homeData.popular || homeData.mostRead || [];
      for (const manga of list) {
        if (!manga?.slug) continue;
        items.push({
          type: "simpleCarouselItem",
          mangaId: manga.slug,
          title: manga.title || "Sem título",
          subtitle: manga.chapterCount ? `${manga.chapterCount} cap.` : undefined,
          imageUrl:
            manga.coverUrl ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(manga.title || "Manga") +
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
    _metadata?: any,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const searchTerm = query.title?.trim() || "";
    let url = `${API_BASE}/search?q=${encodeURIComponent(searchTerm)}`;

    if (!searchTerm) {
      url = `${API_BASE}/home`;
    }

    const request = { url, method: "GET" };
    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    if (response.status !== 200 || data.trim().startsWith("<")) {
      throw new Error(`Erro na busca (HTTP ${response.status})`);
    }
    const json = JSON.parse(data);

    const items: SearchResultItem[] = [];
    const rawList = !searchTerm ? json.data?.popular || [] : json.data || [];

    for (const manga of rawList) {
      if (!manga?.slug) continue;
      items.push({
        mangaId: manga.slug,
        title: manga.title || "Sem título",
        imageUrl:
          manga.coverUrl ||
          "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(manga.title || "Manga") +
            "&background=random",
        contentRating: ContentRating.EVERYONE,
      });
    }

    return { items, metadata: undefined };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_BASE}/works/${encodeURIComponent(mangaId)}`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    if (response.status !== 200 || data.trim().startsWith("<")) {
      throw new Error(`Obra não encontrada (HTTP ${response.status})`);
    }
    const json = JSON.parse(data);
    const manga = json.data;

    if (!manga) {
      throw new Error(`Falha ao carregar detalhes para o mangá: ${mangaId}`);
    }

    const statusMap: Record<string, string> = {
      published: "ONGOING",
      ongoing: "ONGOING",
      completed: "COMPLETED",
    };

    const genres: Tag[] =
      manga.tags?.map((t: string, idx: number) => ({
        id: String(idx),
        title: String(t),
      })) || [];

    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(manga.title || "Manga") +
      "&background=random";
    const thumbnailUrl = manga.coverUrl || fallbackImage;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: manga.title || "Sem título",
        secondaryTitles: manga.altTitles || [],
        thumbnailUrl,
        synopsis: manga.description || manga.synopsis || "",
        contentRating: manga.isAdult ? ContentRating.MATURE : ContentRating.EVERYONE,
        status: statusMap[manga.status] || statusMap[manga.publicationStatus] || "UNKNOWN",
        author: manga.author || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: manga.coverUrl ? [manga.coverUrl] : [thumbnailUrl],
        shareUrl: `https://manganyx.com/series/${manga.slug || mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${API_BASE}/works/${encodeURIComponent(sourceManga.mangaId)}/chapters?limit=500&page=${page}`;
      const request = { url, method: "GET" };

      const [response, buffer] = await Application.scheduleRequest(request);
      const data = Application.arrayBufferToUTF8String(buffer);
      if (response.status !== 200 || data.trim().startsWith("<")) {
        break;
      }
      const json = JSON.parse(data);

      const list = json.data || [];
      if (json.meta?.totalPages) {
        totalPages = json.meta.totalPages;
      }

      for (const ch of list) {
        if (!ch) continue;
        const num = ch.number != null ? ch.number : 0;
        chapters.push({
          chapterId: ch.id ? String(ch.id) : String(num),
          sourceManga,
          title: ch.title ? `${ch.title}` : `Capítulo ${num}`,
          chapNum: Number(num) || 0,
          publishDate: ch.publishedAt ? new Date(ch.publishedAt) : undefined,
          langCode: "PT-BR",
          volume: 0,
        });
      }

      page++;
    } while (page <= totalPages);

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${API_BASE}/works/${encodeURIComponent(chapter.sourceManga.mangaId)}/chapters/${encodeURIComponent(chapter.chapterId)}/pages`;
    const request = { url, method: "GET" };

    const [response, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    if (response.status !== 200 || data.trim().startsWith("<")) {
      throw new Error(`Capítulo não encontrado (HTTP ${response.status})`);
    }
    const json = JSON.parse(data);

    const rawPages = json.data?.pages || [];
    rawPages.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

    const pages: string[] = [];
    let key: string | null = null;
    let keyFetchFailed = false;

    const firstEncrypted = rawPages.find((p: any) => {
      const u = p?.imageUrl || p?.url;
      return typeof u === "string" && !u.startsWith("http://") && !u.startsWith("https://");
    });

    if (firstEncrypted) {
      const rawUrl = firstEncrypted.imageUrl || firstEncrypted.url;
      try {
        const { v, e } = getParams(rawUrl);
        key = await this.getKey(v, e);
      } catch (err) {
        keyFetchFailed = true;
        if (err instanceof CloudflareError) {
          throw err;
        }
        throw err;
      }
    }

    for (const p of rawPages) {
      const rawUrl = p.imageUrl || p.url;
      if (!rawUrl || typeof rawUrl !== "string") continue;

      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        pages.push(rawUrl);
        continue;
      }

      if (keyFetchFailed || !key) continue;

      try {
        let decrypted = decrypt(rawUrl, key);
        if (decrypted.startsWith("//")) {
          decrypted = "https:" + decrypted;
        } else if (decrypted.startsWith("/")) {
          decrypted = "https://manganyx.com" + decrypted;
        }

        if (decrypted.startsWith("http://") || decrypted.startsWith("https://")) {
          pages.push(decrypted);
        }
      } catch {
        // Ignora falha de descriptografia em página corrompida individual
      }
    }

    if (pages.length === 0 && rawPages.length > 0) {
      const resolutionRequest = await this.getCloudflareResolutionRequest();
      throw new CloudflareError(
        resolutionRequest,
        "Não foi possível carregar as páginas do capítulo. Proteção Cloudflare ativa! Toque para resolver.",
      );
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }
}

export const MangaNYX = new MangaNYXExtension();
