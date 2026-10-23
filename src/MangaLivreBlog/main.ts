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

const BASE_URL = "https://mangalivre.blog";

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src =
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    $img.attr("srcset")?.split(" ")[0] ||
    $img.attr("src") ||
    $img.attr("data-cfsrc") ||
    "";
  src = src.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  return src.startsWith("/") ? BASE_URL + src : src;
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

function parsePortugueseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const str = dateStr
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const now = new Date();

  if (
    str.includes("agora") ||
    str.includes("just now") ||
    str.includes("segundo") ||
    str.includes("second") ||
    str === "hoje" ||
    str === "today"
  ) {
    return now;
  }

  if (str.includes("ontem") || str.includes("yesterday")) {
    return new Date(now.getTime() - 86400 * 1000);
  }

  const minMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:minutos?|mins?|minutes?)(?:\s*(?:atras|ago))?/);
  if (minMatch?.[1]) {
    return new Date(now.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);
  }

  const hourMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:horas?|hours?|\bh\b)(?:\s*(?:atras|ago))?/);
  if (hourMatch?.[1]) {
    return new Date(now.getTime() - parseInt(hourMatch[1], 10) * 3600 * 1000);
  }

  const dayMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:dias?|days?)(?:\s*(?:atras|ago))?/);
  if (dayMatch?.[1]) {
    return new Date(now.getTime() - parseInt(dayMatch[1], 10) * 86400 * 1000);
  }

  const weekMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:semanas?|weeks?)(?:\s*(?:atras|ago))?/);
  if (weekMatch?.[1]) {
    return new Date(now.getTime() - parseInt(weekMatch[1], 10) * 7 * 86400 * 1000);
  }

  const monthMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:mes|meses|months?)(?:\s*(?:atras|ago))?/);
  if (monthMatch?.[1]) {
    return new Date(now.getTime() - parseInt(monthMatch[1], 10) * 30 * 86400 * 1000);
  }

  const yearMatch = str.match(/(?:ha\s*)?(\d+)\s*(?:anos?|years?)(?:\s*(?:atras|ago))?/);
  if (yearMatch?.[1]) {
    return new Date(now.getTime() - parseInt(yearMatch[1], 10) * 365 * 86400 * 1000);
  }

  const MONTHS_PT: Record<string, number> = {
    janeiro: 0,
    jan: 0,
    january: 0,
    fevereiro: 1,
    fev: 1,
    february: 1,
    feb: 1,
    marco: 2,
    mar: 2,
    march: 2,
    abril: 3,
    abr: 3,
    april: 3,
    apr: 3,
    maio: 4,
    mai: 4,
    may: 4,
    junho: 5,
    jun: 5,
    june: 5,
    julho: 6,
    jul: 6,
    july: 6,
    agosto: 7,
    ago: 7,
    august: 7,
    setembro: 8,
    set: 8,
    september: 8,
    sep: 8,
    outubro: 9,
    out: 9,
    october: 9,
    oct: 9,
    novembro: 10,
    nov: 10,
    november: 10,
    dezembro: 11,
    dez: 11,
    december: 11,
    dec: 11,
  };

  const mdyMatch = str.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdyMatch?.[1] && mdyMatch[2] && mdyMatch[3]) {
    const mIdx = MONTHS_PT[mdyMatch[1]];
    if (mIdx !== undefined) {
      return new Date(parseInt(mdyMatch[3], 10), mIdx, parseInt(mdyMatch[2], 10));
    }
  }

  const dmyMatch = str.match(/(\d{1,2})\s*(?:de)?\s*([a-z]+)\s*(?:de)?,?\s*(\d{4})/);
  if (dmyMatch?.[1] && dmyMatch[2] && dmyMatch[3]) {
    const mIdx = MONTHS_PT[dmyMatch[2]];
    if (mIdx !== undefined) {
      return new Date(parseInt(dmyMatch[3], 10), mIdx, parseInt(dmyMatch[1], 10));
    }
  }

  const slashMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    return new Date(
      parseInt(slashMatch[3], 10),
      parseInt(slashMatch[2], 10) - 1,
      parseInt(slashMatch[1], 10),
    );
  }

  const ymdMatch = str.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch?.[1] && ymdMatch[2] && ymdMatch[3]) {
    return new Date(
      parseInt(ymdMatch[1], 10),
      parseInt(ymdMatch[2], 10) - 1,
      parseInt(ymdMatch[3], 10),
    );
  }

  const shortYearMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2})/);
  if (shortYearMatch?.[1] && shortYearMatch[2] && shortYearMatch[3]) {
    const yr = 2000 + parseInt(shortYearMatch[3], 10);
    return new Date(yr, parseInt(shortYearMatch[2], 10) - 1, parseInt(shortYearMatch[1], 10));
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export class MangaLivreBlogExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        title: "Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "updates",
        title: "Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "recommended",
        title: "Recomendados",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = `${BASE_URL}/page/${page}/`;

    if ((section.id === "popular" || section.id === "recommended") && page > 1) {
      return { items: [], metadata: undefined };
    }

    const request = {
      url,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];

    if (section.id === "popular") {
      const popContainer = $(".home-popular, .home-popular-track");
      const populars = popContainer.length
        ? popContainer.find("article, .home-manga-card")
        : $(".home-popular article, .sidebar .popular-item-wrap, .popular-item-wrap");

      populars.toArray().forEach((el) => {
        const title = $(el)
          .find(".home-card-body h3 a, .manga-title-modern, .manga-title, h3 a, h3")
          .first()
          .text()
          .trim();
        const subtitle = $(el)
          .find(".home-card-chapters a, .chapter-item-modern a")
          .first()
          .text()
          .trim()
          .replace(/\s+/g, " ");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());
        const href = $(el).find("a.home-manga-cover, a.manga-cover-link, a").first().attr("href");

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          let safeImg = img;
          if (safeImg && safeImg.startsWith("http")) {
            safeImg = safeImg.includes("?") ? safeImg + "&v=4" : safeImg + "?v=4";
          } else {
            safeImg =
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title) +
              "&background=random";
          }

          items.push({
            mangaId,
            title,
            subtitle: subtitle || undefined,
            imageUrl: safeImg,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      let updates = $(
        ".home-latest-grid article, .home-latest article, .home-latest .home-manga-card",
      );
      if (updates.length === 0) {
        updates = $("article.home-manga-card, article").not(
          ".home-popular article, .home-popular-track article, .home-featured-track article, .home-featured article",
        );
      }

      updates.each((_, el) => {
        const title = $(el)
          .find(".home-card-body h3 a, .manga-title-modern, .manga-title, h3 a, h3")
          .first()
          .text()
          .trim();
        const href = $(el).find("a.home-manga-cover, a.manga-cover-link, a").first().attr("href");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());
        const chapterEl = $(el).find(".home-card-chapters a, .chapter-item-modern a").first();
        const chapterSubtitle = chapterEl.text().trim().replace(/\s+/g, " ");
        const chapterHref = chapterEl.attr("href") || "unknown";

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          let safeImg = img;
          if (safeImg && safeImg.startsWith("http")) {
            safeImg = safeImg.includes("?") ? safeImg + "&v=4" : safeImg + "?v=4";
          } else {
            safeImg =
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title) +
              "&background=random";
          }

          items.push({
            mangaId,
            chapterId: chapterHref,
            title,
            subtitle: chapterSubtitle || undefined,
            imageUrl: safeImg,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });
      return {
        items,
        metadata: items.length > 0 ? page + 1 : undefined,
      };
    }

    if (section.id === "recommended") {
      let recommended = $(".home-featured-slide");
      if (recommended.length === 0) {
        recommended = $(
          ".home-popular article.home-manga-card, .home-popular .home-manga-card, .manga-card-modern",
        );
      }

      recommended.each((_, el) => {
        const title = $(el)
          .find(".home-featured-title, .home-card-body h3 a, h1, h2, h3")
          .first()
          .text()
          .trim();
        const href = $(el)
          .find("a.home-featured-cover, a.home-manga-cover, a[href*='/manga/']")
          .first()
          .attr("href");
        const img = getImageSrc($(el).find("img.manga-cover-img, img").first());

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;
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
        }
      });
      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "recentes" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const orderBy = query.metadata?.orderBy ?? "recentes";
    let searchUrl: string;

    if (query.title && query.title.trim()) {
      searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title.trim())}`;
    } else {
      searchUrl =
        page === 1
          ? `${BASE_URL}/manga/?ordem=${encodeURIComponent(orderBy)}`
          : `${BASE_URL}/manga/page/${page}/?ordem=${encodeURIComponent(orderBy)}`;
    }

    const request = { url: searchUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];

    $(".manga-card, .c-tabs-item__content, article.home-manga-card").each((_, el) => {
      const linkEl = $(el).find("a.manga-card-link, .post-title h3 a, a[href*='/manga/']").first();
      const href = linkEl.attr("href");
      const title = $(el)
        .find(".manga-card-title, h3 a, h3, .post-title h3 a")
        .first()
        .text()
        .trim();
      const img = getImageSrc($(el).find("img.manga-cover-img, .tab-thumb a img, img").first());

      if (href && title) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        items.push({
          mangaId,
          title,
          imageUrl:
            img ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(title || "Manga") +
              "&background=random",
          contentRating: ContentRating.EVERYONE,
        });
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $(".manga-title, .post-title h1, h1")
        .filter((_, el) => !$(el).hasClass("site-title"))
        .first()
        .text()
        .trim() ||
      $("h1")
        .map((_, el) => $(el).text().trim())
        .get()
        .find((t) => t.length > 0) ||
      "";

    const rawImage = getImageSrc(
      $(
        ".manga-cover img, img.manga-cover-img, .manga-poster img, .manga-info img, .summary_image img",
      ).first(),
    );
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(title || "Manga") +
      "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".synopsis-content, .manga-synopsis, .synopsis, .description-summary .summary__content, .manga-description",
    )
      .first()
      .text()
      .replace(/^Sinopse\s*/i, "")
      .trim();

    let author = "";
    let statusText = "";
    $(".manga-meta-item, .post-content_item").each((_, el) => {
      const txt = $(el).text().trim();
      if (!author && txt.includes("Autor:")) author = txt.replace("Autor:", "").trim();
      if (!statusText && txt.includes("Status:"))
        statusText = txt.replace("Status:", "").trim().toLowerCase();
    });

    if (!author) {
      author = $(".author-content a").text().trim() || "Desconhecido";
    }

    let status = "ONGOING";
    if (statusText.includes("completo") || statusText.includes("completed")) {
      status = "COMPLETED";
    }

    const genres: Tag[] = [];
    const addedGenres = new Set<string>();
    $(
      ".manga-tags .manga-tag, .genres-content a, .manga-genres a, .genres a, a[href*='/genero/'], a[href*='/genre/']",
    ).each((_, el) => {
      const g = $(el).text().trim();
      if (g && !/^\d+$/.test(g)) {
        const id = sanitizeTagId(g);
        if (!addedGenres.has(id)) {
          addedGenres.add(id);
          genres.push({ id, title: g });
        }
      }
    });

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title || "Sem título",
        secondaryTitles: [],
        thumbnailUrl,
        synopsis: synopsis === "Sinopse" ? "" : synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author: author || "Desconhecido",
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: image ? [image] : [thumbnailUrl],
        shareUrl: url,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/`;
    const request = {
      url,
      method: "GET",
    };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const chapters: Chapter[] = [];
    const addedUrls = new Set<string>();

    const parseChapterElements = ($root: cheerio.CheerioAPI) => {
      $root("li.chapter-item, .chapter-item, .wp-manga-chapter").each((_, el) => {
        const a = $root(el).find("a.chapter-link, a").first();
        const href = a.attr("href")?.trim() || "";
        if (!href || addedUrls.has(href)) return;
        addedUrls.add(href);

        let name = a.find(".chapter-number").text().trim() || a.text().trim();
        name = name.replace(/\s+/g, " ").trim();

        const numMatch = name.match(/[\d.]+/);
        const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

        const rawDate = $root(el)
          .find(".chapter-date, .chapter-release-date, i, time, span.date")
          .first()
          .text()
          .trim();
        const publishDate = parsePortugueseDate(rawDate);

        chapters.push({
          chapterId: href,
          sourceManga,
          langCode: "PT-BR",
          chapNum,
          title: name,
          volume: 0,
          publishDate,
        });
      });
    };

    parseChapterElements($);

    const btn = $("#sr-load-chapters");
    const mangaNumId = btn.attr("data-manga");
    let offset = parseInt(btn.attr("data-offset") || "0", 10);
    const total = parseInt(btn.attr("data-total") || "0", 10);

    if (mangaNumId && total > chapters.length) {
      while (offset < total) {
        try {
          const req = {
            url: `${BASE_URL}/wp-json/slimeread/v1/chapters/${mangaNumId}?offset=${offset}`,
            method: "GET",
          };
          const [__, apiBuffer] = await Application.scheduleRequest(req);
          const apiDataStr = Application.arrayBufferToUTF8String(apiBuffer);
          const apiData = JSON.parse(apiDataStr);
          if (!apiData.list) break;
          const $list = cheerio.load(`<ul>${apiData.list}</ul>`);
          parseChapterElements($list);
          if (apiData.offset <= offset) break;
          offset = apiData.offset;
          if (!apiData.has_more) break;
        } catch {
          break;
        }
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = chapter.chapterId;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    $(
      ".chapter-images img, .chapter-reader img, .page-break img, .reading-content img, .chapter-image img, #chapter-container img, article img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (src && !pages.includes(src) && !src.includes("logo") && !src.includes("avatar")) {
        pages.push(src);
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
export const MangaLivreBlog = new MangaLivreBlogExtension();
