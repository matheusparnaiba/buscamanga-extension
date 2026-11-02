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

const BASE_URL = "https://montetaiscanlator.xyz";

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
    $img.attr("data-lzl-src") ||
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    "";

  if (!src) {
    const srcset = $img.attr("data-lzl-srcset") || $img.attr("srcset");
    if (srcset) {
      src = srcset.split(",")[0]?.trim()?.split(" ")[0]?.trim() || "";
    }
  }

  if (!src || src.startsWith("data:")) {
    const rawSrc = $img.attr("src") || $img.attr("data-cfsrc") || "";
    if (rawSrc && !rawSrc.startsWith("data:")) {
      src = rawSrc;
    }
  }

  if (!src || src.startsWith("data:")) {
    const noscript = $img.parent().find("noscript").text();
    const match = noscript.match(/src=["']([^"']+)["']/i);
    if (match?.[1]) src = match[1];
  }

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

export class MonteTaiExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "featured",
        title: "Destaques",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Obras Populares",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "new_manga",
        title: "Mais Novos",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "manhwa",
        title: "Manhwas",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "manhua",
        title: "Manhuas & Cultivação",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "artes_marciais",
        title: "Artes Marciais",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "sistema",
        title: "Sistema",
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
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    try {
      if (section.id === "featured") {
        if (page > 1) return { items: [], metadata: undefined };
        const [_, buffer] = await Application.scheduleRequest({
          url: `${BASE_URL}/`,
          method: "GET",
        });
        const html = Application.arrayBufferToUTF8String(buffer);
        const $ = cheerio.load(html);
        const items: DiscoverSectionItem[] = [];

        $(".mt-featured-slider article.mt-featured-slide").each((_, el) => {
          const title = $(el)
            .find(".mt-featured-slide__title a, h2 a, h3 a, .mt-featured-slide__title")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          const href = $(el).find("a[href*='/manga/']").first().attr("href") || "";
          const style = $(el).attr("style") || "";
          const bgMatch = style.match(/--mt-hero-bg\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
          const img = sanitizeImageUrl((bgMatch?.[1] || $(el).find("img").attr("src")) ?? "");
          const pills = $(el)
            .find(".mt-featured-pill")
            .map((_, p) => $(p).text().trim())
            .get()
            .join(" • ");
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = (idMatch?.[1] ?? href) as string;

          if (mangaId && title) {
            items.push({
              mangaId,
              title,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
              subtitle: pills || undefined,
              type: "prominentCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        });

        return { items, metadata: undefined };
      }

      if (section.id === "updates") {
        const url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
        const [_, buffer] = await Application.scheduleRequest({
          url,
          method: "GET",
        });
        const html = Application.arrayBufferToUTF8String(buffer);
        const $ = cheerio.load(html);
        const items: DiscoverSectionItem[] = [];
        const seenIds = new Set<string>();

        $(".mt-home-lab-catalog__grid article.mt-manga-catalog-card").each((_, el) => {
          const title = $(el)
            .find(".mt-manga-catalog-card__title a, h2 a")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          const href =
            $(el)
              .find(".mt-manga-catalog-card__title a, a.mt-manga-catalog-card__poster")
              .first()
              .attr("href") || "";
          const img = getImageSrc($(el).find(".mt-manga-catalog-card__poster img, img").first());

          const firstChap = $(el)
            .find(".mt-manga-catalog-card__chapters a.mt-manga-catalog-card__chapter")
            .first();
          const chapHref = firstChap.attr("href") || "";
          const chapLabel = firstChap.find(".mt-manga-catalog-card__chapter-label").text().trim();
          const chapDate = firstChap.find(".mt-manga-catalog-card__chapter-side").text().trim();
          const subtitle =
            [chapLabel, chapDate].filter(Boolean).join(" • ") ||
            $(el).find(".mt-manga-catalog-card__type").text().trim() ||
            "Capítulo";

          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = (idMatch?.[1] ?? href) as string;

          if (mangaId && title && !seenIds.has(mangaId)) {
            seenIds.add(mangaId);
            items.push({
              mangaId,
              chapterId: chapHref || mangaId,
              title,
              subtitle,
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

        const hasNextPage =
          $(".pagination a, .nav-links a, a[href*='/page/" + (page + 1) + "/']").length > 0 ||
          items.length >= 18;
        return {
          items,
          metadata: hasNextPage ? page + 1 : undefined,
        };
      }

      if (section.id === "popular" && page === 1) {
        const [_, buffer] = await Application.scheduleRequest({
          url: `${BASE_URL}/`,
          method: "GET",
        });
        const html = Application.arrayBufferToUTF8String(buffer);
        const $ = cheerio.load(html);
        const items: DiscoverSectionItem[] = [];
        const seenIds = new Set<string>();

        $(".mt-popular-home article.mt-popular-home__card").each((_, el) => {
          const title = $(el)
            .find(".mt-popular-home__title a, h3 a")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          const href =
            $(el).find("a.mt-popular-home__thumb, a[href*='/manga/']").first().attr("href") || "";
          const img = getImageSrc($(el).find("img").first());
          const rank = $(el).find(".mt-popular-home__rank").text().trim();
          const views = $(el).find(".mt-popular-home__views").text().trim();
          const subtitle = [rank, views].filter(Boolean).join(" • ");
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = (idMatch?.[1] ?? href) as string;

          if (mangaId && title && !seenIds.has(mangaId)) {
            seenIds.add(mangaId);
            items.push({
              mangaId,
              title,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
              subtitle: subtitle || undefined,
              type: "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
        });

        if (items.length > 0) {
          return { items, metadata: 2 };
        }
      }

      let catalogUrl = `${BASE_URL}/manga/?pg=${page}`;
      if (section.id === "popular") {
        catalogUrl = `${BASE_URL}/manga/?ordem=views&pg=${page}`;
      } else if (section.id === "new_manga") {
        catalogUrl = `${BASE_URL}/manga/?ordem=new-manga&pg=${page}`;
      } else if (section.id === "manhwa") {
        catalogUrl = `${BASE_URL}/manga/?genero=manhwa&pg=${page}`;
      } else if (section.id === "manhua") {
        catalogUrl = `${BASE_URL}/manga/?tipo=manhua&pg=${page}`;
      } else if (section.id === "artes_marciais") {
        catalogUrl = `${BASE_URL}/manga/?genero=artes-marciais&pg=${page}`;
      } else if (section.id === "sistema") {
        catalogUrl = `${BASE_URL}/manga/?genero=sistema&pg=${page}`;
      } else if (section.id === "acao") {
        catalogUrl = `${BASE_URL}/manga/?genero=acao&pg=${page}`;
      } else if (section.id === "fantasia") {
        catalogUrl = `${BASE_URL}/manga/?genero=fantasia&pg=${page}`;
      }

      const [_, buffer] = await Application.scheduleRequest({
        url: catalogUrl,
        method: "GET",
      });
      const html = Application.arrayBufferToUTF8String(buffer);
      const $ = cheerio.load(html);
      const items: DiscoverSectionItem[] = [];
      const seenIds = new Set<string>();

      $("article.mt-manga-catalog-card").each((_, el) => {
        const title = $(el)
          .find(".mt-manga-catalog-card__title a, h2 a")
          .first()
          .text()
          .replace(/\s+/g, " ")
          .trim();
        const href =
          $(el)
            .find(".mt-manga-catalog-card__title a, a.mt-manga-catalog-card__poster")
            .first()
            .attr("href") || "";
        const img = getImageSrc($(el).find(".mt-manga-catalog-card__poster img, img").first());
        const type = $(el).find(".mt-manga-catalog-card__type").text().trim();
        const views = $(el).find(".mt-manga-catalog-card__metric").first().text().trim();
        const subtitle = views || type || undefined;
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = (idMatch?.[1] ?? href) as string;

        if (mangaId && title && !seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            subtitle,
            type: "simpleCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      });

      const hasNextPage = items.length >= 20;
      return { items, metadata: hasNextPage ? page + 1 : undefined };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id} no Monte Tai:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "views" },
    });
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const orderBy = query.metadata?.orderBy ?? "views";
    const genre = query.metadata?.genre;
    const status = query.metadata?.status;

    let url: string;
    if (title) {
      url = `${BASE_URL}/manga/?busca=${encodeURIComponent(title)}&pg=${page}`;
    } else {
      const params = new URLSearchParams();
      if (orderBy) params.set("ordem", orderBy);
      if (genre && genre !== "all") params.set("genero", genre);
      if (status && status !== "all") params.set("status", status);
      params.set("pg", String(page));
      url = `${BASE_URL}/manga/?${params.toString()}`;
    }

    const request = {
      url,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $(
      "article.mt-manga-catalog-card, .manga__item, .c-tabs-item__content, .page-item-detail, .search-wrap .row, .manga-item",
    ).each((_, el) => {
      const titleEl = $(el)
        .find(
          ".mt-manga-catalog-card__title a, .post-title h2 a, .post-title h3 a, .post-title a, h2 a, h3 a, h4 a, h5 a, h3",
        )
        .first();
      const mangaTitle = titleEl.text().replace(/\s+/g, " ").trim();
      const linkEl = $(el)
        .find(
          ".mt-manga-catalog-card__title a, .post-title h2 a, .post-title a, a[href*='/manga/'], a",
        )
        .first();
      const href = linkEl.attr("href");
      const img = getImageSrc($(el).find(".mt-manga-catalog-card__poster img, img").first());

      if (href && mangaTitle) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: mangaTitle,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(mangaTitle) +
                "&background=random",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }
    });

    const hasNextPage = items.length >= 20;
    return {
      items,
      metadata: hasNextPage ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $("h1, .mtx-hero-title, .post-title h1, .post-title h3")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() || mangaId.replace(/-/g, " ");

    const image =
      sanitizeImageUrl($("meta[property='og:image']").attr("content") || "") ||
      sanitizeImageUrl($(".mtx-chapter-list").attr("data-mtx-cover") || "") ||
      getImageSrc(
        $("img.img-responsive, .mtx-hero-poster img, .summary_image img, .tab-summary img").first(),
      );
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $(
        ".mtx-hero-subtitle, .description-summary .summary__content, .summary__content, .manga-excerpt, .post-content",
      )
        .first()
        .text()
        .trim() ||
      "";

    let status = "ongoing";
    const statusText = $(
      ".mtx-pill-status, .post-status .summary-content, .summary-heading:contains('Status') + .summary-content",
    )
      .text()
      .trim()
      .toLowerCase();
    if (statusText.includes("completo") || statusText.includes("completed")) {
      status = "completed";
    }

    const author =
      $(
        ".author-content a, .mtx-hero-meta a, .summary-heading:contains('Autor') + .summary-content, .summary-heading:contains('Author') + .summary-content",
      )
        .first()
        .text()
        .trim() || "Desconhecido";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $(".genres-content a, .mtx-pill, a[href*='/genero/']").each((_, el) => {
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

    const pageReq = {
      url: `${BASE_URL}/manga/${slug}/`,
      method: "GET",
    };
    const [_, pageBuf] = await Application.scheduleRequest(pageReq);
    const pageData = Application.arrayBufferToUTF8String(pageBuf);
    let $ = cheerio.load(pageData);

    if ($("a.mtx-chapter-item, li.wp-manga-chapter, li.chapter-item").length === 0) {
      try {
        const ajaxReq = {
          url: `${BASE_URL}/manga/${slug}/ajax/chapters/`,
          method: "POST",
        };
        const [_, ajaxBuffer] = await Application.scheduleRequest(ajaxReq);
        chaptersData = Application.arrayBufferToUTF8String(ajaxBuffer);
        if (chaptersData) $ = cheerio.load(chaptersData);
      } catch (e) {
        console.error("Erro ao buscar capítulos via ajax/chapters:", e);
      }
    }

    const chapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    $("a.mtx-chapter-item, li.wp-manga-chapter, li.chapter-item").each((_, el) => {
      const a = $(el).is("a") ? $(el) : $(el).find("a").first();
      const href = a.attr("href")?.trim() ?? "";
      const name = $(el).find(".mtx-chapter-title").text().trim() || a.text().trim();
      const numMatch = name.match(/[\d.]+/);
      const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;

      if (href && !seenChapters.has(href)) {
        seenChapters.add(href);
        const rawDate = $(el)
          .find(".mtx-chapter-meta, .chapter-release-date, i, .c-new-tag, time")
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

    $(
      ".reading-content img, .entry-content img, .chapter-images img, .page-break img, img[src*='cdn.montetaiscanlator.xyz'], img[src*='uploads']",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logo") &&
        !src.includes("banner") &&
        !seenPages.has(src)
      ) {
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

export const MonteTai = new MonteTaiExtension();
