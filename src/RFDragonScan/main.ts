/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  CloudflareError,
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
import type {
  ContentTemplateSearchMetadata,
  RFMangaDetailsDto,
  RFPagesDto,
  RFProjectDto,
  RFProjectsPageDto,
  RFSeasonListDto,
} from "./models";
import { MainInterceptor } from "./network";
import type RFDragonScanConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://rfdragonscan.net";

function sanitizeImageUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  let src = raw.trim();
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

let actionIds: Record<string, string> = {
  getOne: "6075432a2003e67d4025a0b390a5b52df9e61a84df",
  getAllChapters: "608dc929646b92127012e8d8d5b8bebae1c2cae8cc",
  getPages: "701b928d969fea96b2124f4f8453277895cb6fae3b",
};

async function refreshActionIds(): Promise<void> {
  const dummyUrls = [`${BASE_URL}/00000000/dummy`, `${BASE_URL}/00000000/dummy/capitulo/1`];
  const scriptUrls = new Set<string>();

  for (const u of dummyUrls) {
    try {
      const [_, buf] = await Application.scheduleRequest({ url: u, method: "GET" });
      const html = Application.arrayBufferToUTF8String(buf);
      const $ = cheerio.load(html);
      $("script[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (src && src.includes("/_next/static/") && src.endsWith(".js")) {
          const full = src.startsWith("http")
            ? src
            : `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
          scriptUrls.add(full);
        }
      });
    } catch {
      // Ignore
    }
  }

  const regex = /createServerReference\)?\s*\(\s*["']([0-9a-fA-F]+)["'][^)]*["']([^"']+)["']\s*\)/g;
  for (const s of scriptUrls) {
    try {
      const [_, sBuf] = await Application.scheduleRequest({ url: s, method: "GET" });
      const js = Application.arrayBufferToUTF8String(sBuf);
      let m: RegExpExecArray | null;
      while ((m = regex.exec(js)) !== null) {
        if (m[2] && m[1]) {
          actionIds[m[2]] = m[1];
        }
      }
    } catch {
      // Ignore
    }
  }
}

async function postAction(url: string, actionName: string, bodyData: any[]): Promise<string> {
  let actionId = actionIds[actionName] || "";
  const body = JSON.stringify(bodyData);

  const perform = async (id: string): Promise<[any, ArrayBuffer]> => {
    return Application.scheduleRequest({
      url,
      method: "POST",
      headers: {
        "next-action": id,
        Accept: "text/x-component",
        Referer: url,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body,
    });
  };

  try {
    const [res, buf] = await perform(actionId);
    if (res.status === 404) {
      await refreshActionIds();
      actionId = actionIds[actionName] || "";
      const [retryRes, retryBuf] = await perform(actionId);
      void retryRes;
      return Application.arrayBufferToUTF8String(retryBuf);
    }
    return Application.arrayBufferToUTF8String(buf);
  } catch {
    await refreshActionIds();
    actionId = actionIds[actionName] || "";
    const [retryRes, retryBuf] = await perform(actionId);
    void retryRes;
    return Application.arrayBufferToUTF8String(retryBuf);
  }
}

function findObjectWithKey(data: any, key: string): any {
  if (!data || typeof data !== "object") return null;
  if (key in data && data[key] !== undefined) return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findObjectWithKey(item, key);
      if (found) return found;
    }
    return null;
  }
  for (const k of Object.keys(data)) {
    const found = findObjectWithKey(data[k], key);
    if (found) return found;
  }
  return null;
}

function parseRscJson<T>(text: string, indicator: string): T | null {
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.includes(`"${indicator}"`)) {
      const colonIdx = line.indexOf(":");
      const jsonPart = colonIdx !== -1 ? line.substring(colonIdx + 1) : line;
      try {
        const obj = JSON.parse(jsonPart);
        const target = findObjectWithKey(obj, indicator);
        if (target) {
          return target as T;
        }
      } catch {
        // Continue
      }
    }
  }

  const idx = text.indexOf(`"${indicator}"`);
  if (idx !== -1) {
    const startObj = text.lastIndexOf("{", idx);
    const endObj = text.indexOf("}\n", idx);
    if (startObj !== -1 && endObj !== -1) {
      try {
        const obj = JSON.parse(text.substring(startObj, endObj + 1));
        const target = findObjectWithKey(obj, indicator);
        if (target) {
          return target as T;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
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

export class RFDragonScanExtension implements ExtensionImpl<typeof RFDragonScanConfig> {
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
      metadata: { orderBy: "recent" },
    });
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
        title: "Projetos em Destaque",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "all",
        title: "Todos os Projetos",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const url = `${BASE_URL}/projetos?page=${page}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          RSC: "1",
        },
      });
      const text = Application.arrayBufferToUTF8String(buffer);
      const parsed = parseRscJson<RFProjectsPageDto>(text, "projects");
      const projects: RFProjectDto[] = parsed?.projects || [];
      const items: DiscoverSectionItem[] = [];

      for (const p of projects) {
        const title = p.title?.trim() || "Sem título";
        const mangaId = `${p.id}/${p.link}`;
        const imageUrl =
          sanitizeImageUrl(p.cover_image) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: p.status || "Atualizado",
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else if (section.id === "popular") {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      const hasNextPage = parsed?.pagination?.hasNextPage ?? false;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error(`Erro ao carregar seção RF Dragon ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const url = `${BASE_URL}/projetos?page=${page}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          RSC: "1",
        },
      });
      const text = Application.arrayBufferToUTF8String(buffer);
      const parsed = parseRscJson<RFProjectsPageDto>(text, "projects");
      let projects: RFProjectDto[] = parsed?.projects || [];

      if (query.title && query.title.trim().length > 0) {
        const searchLower = query.title.trim().toLowerCase();
        projects = projects.filter((p) => p.title.toLowerCase().includes(searchLower));
      }

      const items: SearchResultItem[] = [];
      for (const p of projects) {
        const title = p.title?.trim() || "Sem título";
        const mangaId = `${p.id}/${p.link}`;
        const imageUrl =
          sanitizeImageUrl(p.cover_image) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = query.title ? false : (parsed?.pagination?.hasNextPage ?? false);
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      if (e instanceof CloudflareError) throw e;
      console.error("Erro na busca RF Dragon Scan:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const segments = mangaId.replace(/^\//, "").split("/");
    const id = segments[0] || "";
    const slug = segments[1] || "";
    const mangaUrl = `${BASE_URL}/${id}/${slug}`;

    let title = slug;
    let thumbnailUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;
    let synopsis = "";
    let status = "ongoing";
    let author: string | undefined;
    let artist: string | undefined;
    const tagList: Tag[] = [];

    try {
      const rscResponse = await postAction(mangaUrl, "getOne", [id, slug]);
      const dto =
        parseRscJson<RFMangaDetailsDto>(rscResponse, "title") ||
        parseRscJson<RFMangaDetailsDto>(rscResponse, "synopsis");

      if (dto) {
        title = dto.title || title;
        thumbnailUrl = sanitizeImageUrl(dto.cover_image) || thumbnailUrl;
        synopsis = dto.synopsis || "";
        const s = (dto.status || "").toUpperCase();
        if (s === "FINISHED") {
          status = "completed";
        }

        if (dto.authors && Array.isArray(dto.authors)) {
          author = dto.authors
            .map((a) => a.name)
            .filter(Boolean)
            .join(", ");
        }

        if (dto.artists && Array.isArray(dto.artists)) {
          artist = dto.artists
            .map((a) => a.name)
            .filter(Boolean)
            .join(", ");
        }

        if (dto.genders && Array.isArray(dto.genders)) {
          for (const g of dto.genders) {
            if (g.name) {
              tagList.push({ id: sanitizeTagId(g.name), title: g.name });
            }
          }
        }
      }
    } catch (e) {
      console.error(`Erro ao obter detalhes de ${mangaId}:`, e);
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: author || "RF Dragon Scan",
        artist: artist || author || "RF Dragon Scan",
        tagGroups: tagList.length > 0 ? [{ id: "genres", title: "Gêneros", tags: tagList }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: mangaUrl,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const segments = sourceManga.mangaId.replace(/^\//, "").split("/");
    const id = segments[0] || "";
    const slug = segments[1] || "";
    const mangaUrl = `${BASE_URL}/${id}/${slug}`;
    const chapters: Chapter[] = [];

    try {
      const rscResponse = await postAction(mangaUrl, "getAllChapters", [id, slug]);
      const seasonList = parseRscJson<RFSeasonListDto>(rscResponse, "groups");
      const groups = seasonList?.groups || [];

      for (const group of groups) {
        const chList = group.chapters || [];
        for (const c of chList) {
          if (c.isUpcoming === true || c.hasRestriction === true) continue;
          const rawTitle = String(c.title ?? "").replace(/\.0$/, "");
          const chapNum = parseFloat(rawTitle) || 0;
          const chapterIdentifier = `${id}/${slug}/${rawTitle}`;

          chapters.push({
            chapterId: chapterIdentifier,
            sourceManga,
            langCode: "PT-BR",
            chapNum,
            title: `Capítulo ${rawTitle}`,
            volume: 0,
            publishDate: c.created_at ? new Date(c.created_at) : undefined,
          });
        }
      }

      chapters.sort((a, b) => b.chapNum - a.chapNum);
    } catch (e) {
      console.error(`Erro ao obter capítulos de ${sourceManga.mangaId}:`, e);
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const segments = chapter.chapterId.replace(/^\//, "").split("/");
    const id = segments[0] || "";
    const slug = segments[1] || "";
    const chapterTitle = segments[2] || String(chapter.chapNum);
    const chapterUrl = `${BASE_URL}/${id}/${slug}/capitulo/${chapterTitle}`;

    const pages: string[] = [];

    // 1. Tenta via Server Action getPages se disponível
    try {
      const rscResponse = await postAction(chapterUrl, "getPages", [id, chapterTitle]);
      const pagesDto = parseRscJson<RFPagesDto>(rscResponse, "pages");
      if (pagesDto?.pages && Array.isArray(pagesDto.pages)) {
        for (const p of pagesDto.pages) {
          if (p.photo) {
            pages.push(sanitizeImageUrl(p.photo));
          }
        }
      }
    } catch {
      // Ignore
    }

    // 2. Tenta via requisição RSC da própria página do capítulo
    if (pages.length === 0) {
      try {
        const [_, buffer] = await Application.scheduleRequest({
          url: chapterUrl,
          method: "GET",
          headers: { RSC: "1" },
        });
        const rscText = Application.arrayBufferToUTF8String(buffer);

        if (rscText.includes('"login"') && rscText.includes("redirect")) {
          throw new CloudflareError(
            { url: `${BASE_URL}/login`, method: "GET" },
            "Login necessário no RF Dragon Scan para ler este capítulo!",
          );
        }

        const pagesDto = parseRscJson<RFPagesDto>(rscText, "pages");
        if (pagesDto?.pages && Array.isArray(pagesDto.pages)) {
          for (const p of pagesDto.pages) {
            if (p.photo) {
              pages.push(sanitizeImageUrl(p.photo));
            }
          }
        }

        if (pages.length === 0) {
          const imgMatches = rscText.match(
            /https:\/\/[^"'\\]+\/storage\/[^"'\\]+\.(webp|jpg|jpeg|png)/g,
          );
          if (imgMatches) {
            for (const img of imgMatches) {
              if (!img.includes("logo") && !img.includes("avatar")) {
                pages.push(sanitizeImageUrl(img));
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof CloudflareError) throw err;
      }
    }

    // 3. Fallback: requisição HTML regular
    if (pages.length === 0) {
      try {
        const [_, buffer] = await Application.scheduleRequest({ url: chapterUrl, method: "GET" });
        const html = Application.arrayBufferToUTF8String(buffer);
        if (html.includes("Entrar | RF DragoN") || html.includes('action="/login"')) {
          throw new CloudflareError(
            { url: `${BASE_URL}/login`, method: "GET" },
            "Login necessário no RF Dragon Scan para ler este capítulo!",
          );
        }
        const $ = cheerio.load(html);
        $("img[src]").each((_, el) => {
          const src = $(el).attr("src");
          if (
            src &&
            (src.includes("/storage/") ||
              src.includes(".webp") ||
              src.includes(".jpg") ||
              src.includes(".png"))
          ) {
            if (!src.includes("avatar") && !src.includes("logo")) {
              pages.push(sanitizeImageUrl(src));
            }
          }
        });
      } catch (err) {
        if (err instanceof CloudflareError) throw err;
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

export const RFDragonScan = new RFDragonScanExtension();
