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

const BASE_URL = "https://mangalivre.to";

function sanitizeImageUrl(raw: string): string {
  if (!raw) return "";
  let src = raw.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  try {
    src = decodeURI(src);
  } catch {}
  return encodeURI(src).replace(/%2520/g, "%20").replace(/ /g, "%20");
}

function getImageSrc($img: cheerio.Cheerio<any>): string {
  let src =
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    $img.attr("srcset")?.split(",")[0]?.trim()?.split(" ")[0]?.trim() ||
    $img.attr("src") ||
    $img.attr("data-cfsrc") ||
    "";
  return sanitizeImageUrl(src);
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

export class MangaLivreToExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if (section.id === "popular" && page > 1) {
      return { items: [], metadata: undefined };
    }

    const url =
      section.id === "popular"
        ? page === 1
          ? `${BASE_URL}/manga/?m_orderby=views`
          : `${BASE_URL}/manga/page/${page}/?m_orderby=views`
        : page === 1
          ? `${BASE_URL}/manga/?m_orderby=latest`
          : `${BASE_URL}/manga/page/${page}/?m_orderby=latest`;

    const request = {
      url,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    if (section.id === "popular") {
      $("div.page-item-detail, div.c-tabs-item__content, div.manga-item").each((_, el) => {
        const titleEl = $(el).find(".post-title a, .manga-title, h3 a, h3, h4 a, h4").first();
        const title = titleEl.text().trim();
        const linkEl = $(el).find(".post-title a, a[href*='/manga/']").first();
        const href = linkEl.attr("href");
        const img = getImageSrc($(el).find(".item-thumb img, .post-thumb img, img").first());

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          if (!seenIds.has(mangaId)) {
            seenIds.add(mangaId);
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
        }
      });
      return { items, metadata: undefined };
    }

    if (section.id === "updates") {
      $("div.manga-item, div.page-item-detail, div.c-tabs-item__content").each((_, el) => {
        const titleEl = $(el).find(".manga-title, .post-title a, h3 a, h3, h4 a, h4").first();
        const title = titleEl.text().trim();
        const linkEl = $(el).find("a[href*='/manga/'], .post-title a").first();
        const href = linkEl.attr("href");
        const img = getImageSrc($(el).find(".item-thumb img, .post-thumb img, img").first());

        const chapEl = $(el).find(".chapter-list a.chapter-button, .list-chapter a").first();
        const chapHref = chapEl.attr("href") || "";
        const chapName = chapEl.text().trim() || "Cap. ?";

        if (href && title) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch ? (idMatch[1] as string) : href;

          let chapterId = mangaId;
          if (chapHref) {
            const chapMatch = chapHref.match(/\/manga\/[^/]+\/([^/]+)/);
            if (chapMatch) chapterId = chapMatch[1] as string;
            else chapterId = chapHref;
          }

          if (!seenIds.has(mangaId)) {
            seenIds.add(mangaId);
            items.push({
              mangaId,
              chapterId,
              title,
              subtitle: chapName,
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
      });

      return {
        items,
        metadata: items.length > 0 ? page + 1 : undefined,
      };
    }

    return { items, metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "views" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    _metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const orderBy = query.metadata?.orderBy ?? "views";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";
    const genreParam = genre ? `&genre[]=${encodeURIComponent(genre)}` : "";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const statusParam = status ? `&status[]=${encodeURIComponent(status)}` : "";
    let searchUrl: string;

    if (query.title && query.title.trim()) {
      searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query.title.trim())}&post_type=wp-manga&m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`;
    } else {
      searchUrl = `${BASE_URL}/manga/?m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`;
    }

    const request = { url: searchUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("div.page-item-detail, div.c-tabs-item__content, div.manga-item").each((_, el) => {
      const titleEl = $(el).find(".post-title a, .manga-title, h3 a, h3, h4 a, h4").first();
      const title = titleEl.text().trim();
      const linkEl = $(el).find(".post-title a, a[href*='/manga/']").first();
      const href = linkEl.attr("href");
      const img = getImageSrc($(el).find(".item-thumb img, .post-thumb img, img").first());

      if (href && title) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }
    });

    return {
      items,
      metadata: undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title = $(".post-title h1, h1").first().text().trim() || mangaId;

    let rawImage = "";
    const summaryImg = $(
      ".summary_image img, .post-thumb img, .tab-summary img, .featured-image img, .item-thumb img",
    ).first();
    if (summaryImg.length) {
      rawImage = getImageSrc(summaryImg);
    } else {
      const ogImg = $("meta[property='og:image']").attr("content");
      if (ogImg && ogImg.startsWith("http") && !ogImg.includes("logo")) {
        rawImage = ogImg;
      }
    }
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".description-summary .summary__content, .manga-synopsis, .description-summary",
    )
      .first()
      .text()
      .trim();

    let author = "Desconhecido";
    $(".author-content a, .post-content_item").each((_, el) => {
      const label = $(el).find(".summary-heading").text().toLowerCase();
      if (label.includes("autor") || label.includes("author")) {
        const val = $(el).find(".summary-content, a").text().trim();
        if (val) author = val;
      } else if ($(el).is("a") && $(el).closest(".author-content").length) {
        const val = $(el).text().trim();
        if (val) author = val;
      }
    });

    let status = "ONGOING";
    $(".post-status, .summary-content").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("completo") || text.includes("completed")) status = "COMPLETED";
      else if (text.includes("andamento") || text.includes("ongoing")) status = "ONGOING";
    });

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();
    $(".genres-content a").each((_, el) => {
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
      mangaId,
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
    const slug = sourceManga.mangaId;
    let chaptersData = "";

    try {
      const ajaxReq = {
        url: `${BASE_URL}/manga/${slug}/ajax/chapters/`,
        method: "POST",
      };
      const [_, ajaxBuffer] = await Application.scheduleRequest(ajaxReq);
      chaptersData = Application.arrayBufferToUTF8String(ajaxBuffer);
    } catch (e) {
      console.error("Erro ao buscar capítulos via ajax/chapters:", e);
    }

    let $ = cheerio.load(chaptersData);

    if ($("li.wp-manga-chapter").length === 0) {
      const pageReq = {
        url: `${BASE_URL}/manga/${slug}/`,
        method: "GET",
      };
      const [_, pageBuf] = await Application.scheduleRequest(pageReq);
      const pageData = Application.arrayBufferToUTF8String(pageBuf);
      const $page = cheerio.load(pageData);

      const mangaIdAttr = $page("#manga-chapters-holder").attr("data-id");
      if (mangaIdAttr) {
        try {
          const adminReq = {
            url: `${BASE_URL}/wp-admin/admin-ajax.php`,
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `action=manga_get_chapters&manga=${mangaIdAttr}`,
          };
          const [_, adminBuf] = await Application.scheduleRequest(adminReq);
          chaptersData = Application.arrayBufferToUTF8String(adminBuf);
          $ = cheerio.load(chaptersData);
        } catch (err) {
          console.error("Erro ao buscar capítulos via admin-ajax:", err);
        }
      } else {
        $ = $page;
      }
    }

    const chapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    $("li.wp-manga-chapter, li.chapter-item").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href")?.trim() ?? "";
      const name = a.text().trim();
      const numMatch = name.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

      if (href && !seenChapters.has(href)) {
        seenChapters.add(href);
        const rawDate = $(el)
          .find(".chapter-release-date, i, .c-new-tag, time")
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
      }
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = chapter.chapterId.startsWith("http")
      ? chapter.chapterId
      : `${BASE_URL}${chapter.chapterId.startsWith("/") ? "" : "/"}${chapter.chapterId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const pages: string[] = [];
    const seenPages = new Set<string>();

    $(".reading-content img, .entry-content img, .chapter-images img").each((_, el) => {
      const src = getImageSrc($(el));
      if (src && src.startsWith("http") && !seenPages.has(src)) {
        seenPages.add(src);
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

export const MangaLivreTo = new MangaLivreToExtension();
