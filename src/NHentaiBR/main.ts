import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type JSONValue,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { MainInterceptor } from "./network";
import type NHentaiBRConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://nhentaibr.com";

const SECTIONS: { id: string; title: string; path: string; type: DiscoverSectionType }[] = [
  {
    id: "updates",
    title: "Últimas Atualizações",
    path: "",
    type: DiscoverSectionType.chapterUpdates,
  },
  {
    id: "popular",
    title: "Mais Lidos",
    path: "/category/doujinshi",
    type: DiscoverSectionType.prominentCarousel,
  },
];

function sanitizeTagId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

/** Remove prefixos como "[Hentai]" ou "[Doujinshi]" do título dos posts. */
function cleanTitle(raw: string): string {
  return (
    raw
      .replace(/^(\s*\[[^\]]*\])+/, "")
      .replace(/\s+/g, " ")
      .trim() || raw.trim()
  );
}

function slugFromUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/https?:\/\/[^/]+\/([^/?#]+)\/?$/);
  if (match?.[1]) {
    const slug = match[1];
    if (!["category", "tag", "page", "author", "delivery", "games", "animadas"].includes(slug)) {
      return slug;
    }
  }
  const clean = href.replace(/\/+$/, "").split("/").pop();
  return clean && !clean.includes("?") && !clean.includes("#") ? clean : undefined;
}

function imageFrom($img: cheerio.Cheerio<any>): string {
  const src = (
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("src") ||
    ""
  ).trim();
  return src.startsWith("/") ? BASE_URL + src : src;
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const [, buffer] = await Application.scheduleRequest({ url, method: "GET" });
  return cheerio.load(Application.arrayBufferToUTF8String(buffer));
}

function parseCards($: cheerio.CheerioAPI): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  $(".thumb-conteudo").each((_, el) => {
    // Posts VIP exigem login/assinatura no site e não exibem as páginas
    if ($(el).find(".seloVIP").length > 0) return;

    const a = $(el).find("a[href]:not(.thumbParodiaNome)").first();
    const href = a.attr("href") ?? "";
    const mangaId = slugFromUrl(href);
    const rawTitle =
      $(el).find(".thumb-titulo a, .thumb-titulo").first().text() ||
      a.attr("title") ||
      $(el).find("img").first().attr("alt") ||
      "";
    if (!mangaId || !rawTitle.trim() || seen.has(mangaId)) return;
    seen.add(mangaId);

    items.push({
      mangaId,
      title: cleanTitle(rawTitle),
      imageUrl: imageFrom($(el).find("img").first()),
      contentRating: ContentRating.EVERYONE,
      subtitle: "18+",
    });
  });

  return items;
}

function pageUrl(path: string, page: number): string {
  return page > 1 ? `${BASE_URL}${path}/page/${page}/` : `${BASE_URL}${path}/`;
}

export class NHentaiBRExtension implements ExtensionImpl<typeof NHentaiBRConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 8,
    bufferInterval: 5,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
    }));
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const def = SECTIONS.find((s) => s.id === section.id);
    if (!def) return { items: [] };

    const $ = await fetchHtml(pageUrl(def.path, page));
    const cards = parseCards($);
    const items: DiscoverSectionItem[] = cards.map((item) => {
      if (section.type === DiscoverSectionType.chapterUpdates) {
        return {
          type: "chapterUpdatesCarouselItem",
          mangaId: item.mangaId,
          chapterId: item.mangaId,
          title: item.title,
          subtitle: "Capítulo Único",
          imageUrl: item.imageUrl,
          contentRating: ContentRating.EVERYONE,
        };
      }
      return {
        type: "prominentCarouselItem",
        mangaId: item.mangaId,
        title: item.title,
        imageUrl: item.imageUrl,
        contentRating: ContentRating.EVERYONE,
      };
    });

    return { items, metadata: items.length > 0 ? page + 1 : undefined };
  }

  async getSearchResults(
    query: SearchQuery<JSONValue>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const term = encodeURIComponent(query.title ?? "");
    const url = page > 1 ? `${BASE_URL}/page/${page}/?s=${term}` : `${BASE_URL}/?s=${term}`;

    const items = parseCards(await fetchHtml(url));
    return { items, metadata: items.length > 0 ? page + 1 : undefined };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/${mangaId}/`;
    const $ = await fetchHtml(url);

    const title = cleanTitle($("h1.post-titulo").first().text() || $("h1").first().text());
    const cover =
      $("meta[property='og:image']").attr("content") ||
      imageFrom($(".post-capa img").first()) ||
      undefined;

    const groups = new Map<string, Tag[]>();
    let pages = "";
    $("ul.post-itens li").each((_, li) => {
      const label = $(li).find("strong").first().text().replace(":", "").trim();
      if (!label) return;
      if (/^p[áa]ginas$/i.test(label)) {
        pages = $(li).text().replace(label, "").trim();
        return;
      }
      $(li)
        .find("a")
        .each((__, a) => {
          const text = $(a).text().trim();
          const href = $(a).attr("href") ?? "";
          if (!text || /\/(entrar|cadastro)\/?$/.test(href)) return;
          const tags = groups.get(label) ?? [];
          tags.push({ id: `${sanitizeTagId(label)}-${sanitizeTagId(text)}`, title: text });
          groups.set(label, tags);
        });
    });

    const tagGroups = [...groups.entries()].map(([label, tags]) => ({
      id: sanitizeTagId(label),
      title: label,
      tags,
    }));

    const artist = groups.get("Artista")?.[0]?.title;

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title || mangaId,
        secondaryTitles: [],
        thumbnailUrl:
          cover ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title || "NHentai")}&background=random`,
        synopsis: pages ? `${pages} páginas` : "",
        contentRating: ContentRating.EVERYONE,
        status: "COMPLETED",
        author: artist,
        tagGroups,
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const $ = await fetchHtml(`${BASE_URL}/${sourceManga.mangaId}/`);
    const published = $("meta[property='article:modified_time']").attr("content");
    const publishDate = published ? new Date(published) : undefined;

    const tabs = $("div.galeriaTab");
    if (tabs.length === 0) {
      return [
        {
          chapterId: sourceManga.mangaId,
          sourceManga,
          langCode: "PT-BR",
          chapNum: 1,
          title: "Capítulo Único",
          volume: 0,
          publishDate,
        },
      ];
    }

    const chapters: Chapter[] = [];
    tabs.each((index, el) => {
      const tabId = $(el).attr("data-id") ?? String(index + 1);
      const label = $(el).find(".galeriaTabCapitulo").text().replace(/\s+/g, " ").trim();
      const sub = $(el).find(".galeriaTabTitulo").text().replace(/\s+/g, " ").trim();
      const num = label.match(/\d+(\.\d+)?/);

      chapters.push({
        chapterId: `${sourceManga.mangaId}#${tabId}`,
        sourceManga,
        langCode: "PT-BR",
        chapNum: num ? parseFloat(num[0]) : index + 1,
        title: sub && sub !== label ? `${label} - ${sub}` : label,
        volume: 0,
        publishDate,
      });
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const [slug, tabId] = chapter.chapterId.split("#");
    const $ = await fetchHtml(`${BASE_URL}/${slug}/`);

    const scope = tabId ? $(`#galeria-${tabId} img`) : $("ul.post-fotos li img");
    const pages: string[] = [];
    scope.each((_, img) => {
      const src = imageFrom($(img));
      if (src && !pages.includes(src)) pages.push(src);
    });

    if (pages.length === 0) {
      throw new Error("Conteúdo exclusivo VIP do site: nenhuma página disponível sem login.");
    }

    return { id: chapter.chapterId, mangaId: chapter.sourceManga.mangaId, pages };
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

export const NHentaiBR = new NHentaiBRExtension();
