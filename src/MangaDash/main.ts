/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  type AdvancedSearchForm,
  type Chapter,
  type ChapterDetails,
  type ChapterProviding,
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type ExtensionImpl,
  type Form,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SortingOption,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { ChapterDataDto, MangaDashSearchMetadata, MangaListDto } from "./models";
import { MainInterceptor } from "./network";
import type MangaDashConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://mangadash.net";

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

function cleanCoverUrl(capa?: string | null): string {
  if (!capa) return "";
  let src = capa.trim();
  if (src.startsWith("http")) {
    // keep
  } else if (src.startsWith("../")) {
    src = `${BASE_URL}/static/${src.slice(3)}`;
  } else {
    src = `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
  }
  src = src.replace(/\/static\/covers\/\.\.\/images\//g, "/static/images/");
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

export class MangaDashExtension
  implements
    ExtensionImpl<typeof MangaDashConfig>,
    DiscoverSectionProviding,
    ChapterProviding,
    SearchResultsProviding
{
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

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { sort: "recentes", category: "", status: "" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "destaques",
        title: "Destaques",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Vistos",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "recents",
        title: "Mangás Recentes",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "acao",
        title: "Ação",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "fantasia",
        title: "Fantasia",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "drama",
        title: "Drama",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "aventura",
        title: "Aventura",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "romance",
        title: "Romance",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "hentai",
        title: "Adulto (+18)",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    try {
      if (section.id === "destaques") {
        if (page > 1) {
          return { items: [], metadata: undefined };
        }
        const [_, buffer] = await Application.scheduleRequest({
          url: `${BASE_URL}/`,
          method: "GET",
          headers: {
            referer: `${BASE_URL}/`,
          },
        });
        const html = Application.arrayBufferToUTF8String(buffer);
        const $ = cheerio.load(html);
        const items: DiscoverSectionItem[] = [];

        $(".hero-swiper .swiper-slide").each((_, el) => {
          const link =
            $(el).find("a.hero-btn-v2").attr("href") || $(el).find("a").attr("href") || "";
          const title = $(el).find(".hero-title-v2").text().trim();
          const img = $(el).find("img").attr("src") || "";
          const stats = $(el).find(".hero-stats-v2").text().replace(/\s+/g, " ").trim();
          const mangaId = link.replace(/^\/manga\//, "").replace(/\/$/, "");
          const isAdult =
            $(el).find(".badge-plus18").length > 0 ||
            $(el).hasClass("is-plus18") ||
            $(el).find(".is-plus18").length > 0;

          if (mangaId && title) {
            items.push({
              mangaId,
              title,
              imageUrl: cleanCoverUrl(img),
              subtitle: stats || undefined,
              type: "prominentCarouselItem",
              contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
            });
          }
        });

        return { items, metadata: undefined };
      }

      if (section.id === "updates") {
        const [_, buffer] = await Application.scheduleRequest({
          url: `${BASE_URL}/capitulos?page=${page}`,
          method: "GET",
          headers: {
            referer: `${BASE_URL}/`,
          },
        });
        const html = Application.arrayBufferToUTF8String(buffer);
        const $ = cheerio.load(html);
        const items: DiscoverSectionItem[] = [];

        $(".chapters-grid .card-new").each((_, el) => {
          const mangaLink = $(el).find(".card-title a").attr("href") || "";
          const title = $(el).find(".card-title a").text().trim();
          const chapLink = $(el).find("a.chapter-card-overlay").attr("href") || "";
          const chapNum = $(el).find(".chapter-number-badge").text().trim();
          const time = $(el).find(".chapter-time-badge").text().replace(/\s+/g, " ").trim();
          const img = $(el).find("img").attr("src") || "";
          const mangaId = mangaLink.replace(/^\/manga\//, "").replace(/\/$/, "");

          if (mangaId && title) {
            const subtitle = [chapNum, time].filter(Boolean).join(" • ") || "Recente";
            items.push({
              mangaId,
              chapterId: chapLink || mangaId,
              title,
              subtitle,
              imageUrl: cleanCoverUrl(img),
              type: "chapterUpdatesCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        });

        const hasNextPage = $(".pagination-new a.next").length > 0 || items.length >= 24;
        return {
          items,
          metadata: hasNextPage ? page + 1 : undefined,
        };
      }

      // API-driven sections
      let sort = "populares";
      let categoria = "";
      let plus18 = "";

      if (section.id === "popular") {
        sort = "populares";
      } else if (section.id === "recents") {
        sort = "recentes";
      } else if (section.id === "hentai") {
        sort = "populares";
        categoria = "hentai";
        plus18 = "1";
      } else {
        sort = "populares";
        categoria = section.id;
      }

      const url = `${BASE_URL}/api/mangas/list?page=${page}&q=&sort=${sort}&categoria=${categoria}&status=&ano=&plus18=${plus18}`;
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: MangaListDto = JSON.parse(jsonText);
      const itemsList = data.items ?? [];

      const items: DiscoverSectionItem[] = [];
      for (const m of itemsList) {
        const mangaId = `${m.id}-${m.slug}`;
        const title = m.nome || "Sem título";
        const imageUrl = cleanCoverUrl(m.capa);
        const isAdult = section.id === "hentai" || !!m.isPlus18;

        items.push({
          mangaId,
          title,
          imageUrl,
          subtitle: m.capitulos_count
            ? `${m.capitulos_count} caps`
            : (m.ano_lancamento ?? undefined),
          type: "simpleCarouselItem",
          contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        });
      }

      const hasNextPage = data.pagination?.has_next ?? itemsList.length >= 24;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id} no MangaDash:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<MangaDashSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchTitle = query.title?.trim() ?? "";
    const sort = query.metadata?.sort ?? "recentes";
    const category = query.metadata?.category ?? "";
    const status = query.metadata?.status ?? "";

    const urlBuilder = new URL(`${BASE_URL}/api/mangas/list`);
    urlBuilder.searchParams.set("page", String(page));
    urlBuilder.searchParams.set("q", searchTitle);
    urlBuilder.searchParams.set("sort", sort);
    urlBuilder.searchParams.set("categoria", category);
    urlBuilder.searchParams.set("status", status);
    urlBuilder.searchParams.set("ano", "");
    urlBuilder.searchParams.set("plus18", category === "hentai" ? "1" : "");

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: urlBuilder.toString(),
        method: "GET",
        headers: {
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: MangaListDto = JSON.parse(jsonText);
      const itemsList = data.items ?? [];

      const items: SearchResultItem[] = [];
      for (const m of itemsList) {
        items.push({
          mangaId: `${m.id}-${m.slug}`,
          title: m.nome || "Sem título",
          imageUrl: cleanCoverUrl(m.capa),
          subtitle:
            m.ano_lancamento ?? (m.capitulos_count ? `${m.capitulos_count} caps` : undefined),
        });
      }

      const hasNextPage = data.pagination?.has_next ?? itemsList.length >= 24;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do MangaDash:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const slug = mangaId.replace(/^\/manga\//, "").replace(/\/$/, "");
    const url = `${BASE_URL}/manga/${slug}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
      },
    });

    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const title = $(".neon-title").text().trim() || slug;
    const coverRaw = $(".cover-3d img").attr("src")?.trim() || "";
    const cover = cleanCoverUrl(coverRaw);

    const author = $(".tag-author").text().trim() || "Desconhecido";
    const synopsis = $(".manga-description").text().trim() || "Sem sinopse disponível.";

    const tags: Tag[] = [];
    const seenTagIds = new Set<string>();
    $(".manga-tags a.tag:not(.tag-author)").each((_, el) => {
      const g = $(el).text().trim();
      if (g) {
        const id = sanitizeTagId(g);
        if (!seenTagIds.has(id)) {
          seenTagIds.add(id);
          tags.push({ id, title: g });
        }
      }
    });

    const statsText = $(".stats-row .stat-item").text();
    let status = "ongoing";
    if (
      statsText.toLowerCase().includes("concluído") ||
      statsText.toLowerCase().includes("concluido")
    ) {
      status = "completed";
    } else if (statsText.toLowerCase().includes("hiato")) {
      status = "hiatus";
    }

    const isAdult =
      $(".badge-plus18").length > 0 ||
      $(".is-plus18").length > 0 ||
      tags.some(
        (t) =>
          t.id === "hentai" ||
          t.id.includes("hentai") ||
          t.title.toLowerCase().includes("hentai") ||
          t.title.includes("+18"),
      );

    return {
      mangaId: slug,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: cover,
        synopsis,
        contentRating: isAdult ? ContentRating.ADULT : ContentRating.EVERYONE,
        status,
        author,
        artist: author,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: cover ? [cover] : [],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const slug = sourceManga.mangaId.replace(/^\/manga\//, "").replace(/\/$/, "");
    const url = `${BASE_URL}/manga/${slug}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
      },
    });

    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const chapters: Chapter[] = [];
    $(".chapters-scroll-container .chapter-row").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href) return;

      const title = $(el).find(".chapter-title-group h4").text().trim() || "Capítulo";
      const dateStr = $(el).find(".chapter-meta-info").text().trim();

      const numMatch = title.match(/(\d+(\.\d+)?)/);
      const chapNum = numMatch ? parseFloat(numMatch[1] as string) : -1;

      let publishDate: Date | undefined;
      const parsedDateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (parsedDateMatch) {
        const [__, d, m, y] = parsedDateMatch;
        publishDate = new Date(`${y}-${m}-${d}`);
      }

      chapters.push({
        chapterId: href,
        sourceManga,
        langCode: "PT-BR",
        chapNum: isNaN(chapNum) ? 0 : chapNum,
        title,
        volume: 0,
        publishDate,
      });
    });

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterPath = chapter.chapterId.startsWith("/")
      ? chapter.chapterId
      : `/${chapter.chapterId}`;
    const url = `${BASE_URL}${chapterPath}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        referer: `${BASE_URL}/`,
      },
    });

    const html = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(html);

    const dataScript = $("script#chapterViewerData").html();
    const pages: string[] = [];

    if (dataScript) {
      try {
        const dto: ChapterDataDto = JSON.parse(dataScript);
        const resolved = dto.images ?? dto.imagens ?? dto.pages;

        if (Array.isArray(resolved) && resolved.length > 0) {
          for (const img of resolved) {
            if (typeof img === "string" && img.trim()) {
              pages.push(
                img.startsWith("http") ? img : `${BASE_URL}${img.startsWith("/") ? "" : "/"}${img}`,
              );
            }
          }
        } else {
          let pdfUrl = dto.pdfUrl ?? dto.pdf_url;
          if (pdfUrl && typeof pdfUrl === "string") {
            pdfUrl = pdfUrl.replace(/ /g, "%20");
            if (pdfUrl.startsWith("/")) {
              pdfUrl = `${BASE_URL}${pdfUrl}`;
            }
            pages.push(pdfUrl);
          }
        }
      } catch (e) {
        console.error("Erro ao analisar dados do capítulo do MangaDash:", e);
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

export const MangaDash = new MangaDashExtension();
