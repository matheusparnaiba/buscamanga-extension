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

const BASE_URL = "https://mangaonline.love";

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

export class BuscaMangaExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
        id: "ranking",
        title: "Mais Lidos (Populares)",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "latest",
        title: "Destaques da Semana",
        type: DiscoverSectionType.featured,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    if ((section.id === "latest" || section.id === "ranking") && page > 1) {
      return { items: [], metadata: undefined };
    }

    const url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;

    const request = {
      url,
      method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    if (section.id === "latest") {
      $(".home-featured-slide, .es-hero-slide").each((_, el) => {
        const title = $(el).find(".home-featured-title, .es-hero-title").text().trim();
        const href = $(el)
          .find(".home-featured-cover, .home-featured-actions a, .es-hero-actions a")
          .attr("href");
        const img = getImageSrc($(el).find(".home-featured-cover img, .es-hero-cover img, img"));

        if (href) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch
            ? (idMatch[1] as string)
            : href.replace(/\/+$/, "").split("/").pop() || href;

          if (!seenIds.has(mangaId)) {
            seenIds.add(mangaId);
            items.push({
              mangaId,
              title: title || mangaId,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title || "Manga") +
                  "&background=random",
              type: "featuredCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          }
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
          .find(".home-card-body h3 a, .es-upd-title, h3 a, h3")
          .first()
          .text()
          .trim();
        const href = $(el)
          .find(".home-card-body h3 a, .home-manga-cover, .es-upd-title, a")
          .first()
          .attr("href");
        const img = getImageSrc(
          $(el).find(".home-manga-cover img, .es-upd-cover img, img").first(),
        );

        if (href) {
          const idMatch = href.match(/\/manga\/([^/]+)/);
          const mangaId = idMatch
            ? (idMatch[1] as string)
            : href.replace(/\/+$/, "").split("/").pop() || href;

          const firstChapterEl = $(el).find(".home-card-chapters a, .es-upd-chap").first();
          const chapterUrl = firstChapterEl.attr("href");
          const chapterName =
            firstChapterEl.find("span, .es-upd-chap-name").first().text().trim() ||
            firstChapterEl.text().trim() ||
            "Cap. ?";

          let chapterId = mangaId;
          if (chapterUrl) {
            const chapMatch =
              chapterUrl.match(/\/capitulo\/([^/]+)/) ||
              chapterUrl.match(/\/manga\/[^/]+\/([^/]+)/);
            if (chapMatch) chapterId = chapMatch[1] as string;
            else chapterId = chapterUrl;
          }

          if (!seenIds.has(mangaId)) {
            seenIds.add(mangaId);
            items.push({
              mangaId,
              chapterId,
              title: title || mangaId,
              subtitle: chapterName,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title || "Manga") +
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

    if (section.id === "ranking") {
      $(".home-popular-track article.home-manga-card, .home-popular article.home-manga-card").each(
        (_, el) => {
          const title = $(el).find(".home-card-body h3 a, h3 a, h3").first().text().trim();
          const href = $(el)
            .find(".home-card-body h3 a, .home-manga-cover, a")
            .first()
            .attr("href");
          const img = getImageSrc($(el).find(".home-manga-cover img, img").first());
          const chapEl = $(el).find(".home-card-chapters a").first();
          const subtitle =
            chapEl.find("span").first().text().trim() || chapEl.text().trim() || undefined;

          if (href) {
            const idMatch = href.match(/\/manga\/([^/]+)/);
            const mangaId = idMatch
              ? (idMatch[1] as string)
              : href.replace(/\/+$/, "").split("/").pop() || href;

            if (!seenIds.has(mangaId)) {
              seenIds.add(mangaId);
              items.push({
                mangaId,
                title: title || mangaId,
                subtitle,
                imageUrl:
                  img ||
                  "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(title || "Manga") +
                    "&background=random",
                type: "prominentCarouselItem",
                contentRating: ContentRating.EVERYONE,
              });
            }
          }
        },
      );

      if (items.length === 0) {
        const match = data.match(/var esRankData = ({.*?});/);
        if (match && match[1]) {
          try {
            const rankJson = JSON.parse(match[1]);
            const rankList = rankJson.all || rankJson.month || [];
            for (const item of rankList) {
              if (item.url) {
                const idMatch = item.url.match(/\/manga\/([^/]+)/);
                const mangaId = idMatch ? (idMatch[1] as string) : item.url;
                if (!seenIds.has(mangaId)) {
                  seenIds.add(mangaId);
                  items.push({
                    mangaId,
                    title: item.title,
                    subtitle: item.views
                      ? `${item.views.toLocaleString("pt-BR")} visualizações`
                      : undefined,
                    imageUrl:
                      item.cover ||
                      "https://ui-avatars.com/api/?name=" + encodeURIComponent(item.title),
                    type: "prominentCarouselItem",
                    contentRating: ContentRating.EVERYONE,
                  });
                }
              }
            }
          } catch (e) {
            console.error("Erro ao fazer parse do ranking", e);
          }
        }
      }
      return { items, metadata: undefined };
    }

    return { items: [], metadata: undefined };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    const query: SearchQuery<ContentTemplateSearchMetadata> = {
      title: "",
      metadata: { orderBy: "views", genre: "all" },
    };
    return new ContentTemplateAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const orderBy = query.metadata?.orderBy ?? "views";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";
    const genreParam = genre ? `&genre[]=${encodeURIComponent(genre)}` : "";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const statusParam = status ? `&status[]=${encodeURIComponent(status)}` : "";
    let searchUrl: string;

    if (query.title && query.title.trim()) {
      searchUrl =
        page === 1
          ? `${BASE_URL}/?s=${encodeURIComponent(query.title.trim())}&post_type=wp-manga&m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`
          : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.title.trim())}&post_type=wp-manga&m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`;
    } else {
      searchUrl =
        page === 1
          ? `${BASE_URL}/manga/?m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`
          : `${BASE_URL}/manga/page/${page}/?m_orderby=${encodeURIComponent(orderBy)}${genreParam}${statusParam}`;
    }

    const request = { url: searchUrl, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $(
      ".manga-card, article.home-manga-card, .home-manga-card, .c-tabs-item__content, .search-results-grid .manga-card",
    ).each((_, el) => {
      const titleElement = $(el)
        .find(".manga-card-title, .home-card-body h3 a, .post-title h3 a, h3 a, .title")
        .first();
      const title = titleElement.text().trim();
      const linkElement = $(el)
        .find("a.manga-card-link, .home-card-body h3 a, .home-manga-cover, .tab-thumb a, a")
        .first();
      const href = linkElement.attr("href");
      const img = getImageSrc(
        $(el).find(".manga-cover-img, .home-manga-cover img, .tab-thumb a img, img").first(),
      );

      if (href) {
        const idMatch = href.match(/\/manga\/([^/]+)/);
        const mangaId = idMatch
          ? (idMatch[1] as string)
          : href.replace(/\/+$/, "").split("/").pop() || href;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);
          items.push({
            mangaId,
            title: title || mangaId,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title || "Manga") +
                "&background=random",
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

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manga/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const titleNode = $(".manga-info h1, h1.manga-title, .post-title h1, h1").first().clone();
    titleNode.find(".manga-language-flag, .screen-reader-text").remove();
    const title = titleNode.text().trim() || mangaId;

    const rawImage = getImageSrc(
      $(
        ".manga-cover img, .summary_image a img, .summary_image img, img.manga-cover, .post-thumb img",
      ).first(),
    );
    const image = rawImage && rawImage.startsWith("http") ? rawImage : undefined;
    const fallbackImage =
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";
    const thumbnailUrl = image || fallbackImage;

    const synopsis = $(
      ".manga-synopsis .synopsis-content p, .manga-synopsis .synopsis-content, .description-summary .summary__content, .entry-content",
    )
      .first()
      .text()
      .replace(/^Sinopse\s*/i, "")
      .trim();

    let author = "Desconhecido";
    $(".manga-meta-item, .post-content_item, .author-content").each((_, el) => {
      const label = $(el).find(".meta-label, .summary-heading").text().toLowerCase();
      if (label.includes("autor") || label.includes("author") || label.includes("artista")) {
        const val = $(el).find(".meta-value, .summary-content, a").text().trim();
        if (val) author = val;
      }
    });

    let status = "ONGOING";
    $(
      ".manga-meta-item, .post-status .post-content_item, .home-featured-meta, .home-featured-pills",
    ).each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("completo") || text.includes("completed")) status = "COMPLETED";
      else if (text.includes("andamento") || text.includes("ongoing")) status = "ONGOING";
    });

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();
    $(".manga-tags a, .genres-content a, .manga-card-genres a").each((_, el) => {
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
    const url = `${BASE_URL}/manga/${sourceManga.mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    let $ = cheerio.load(data);
    const chapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    const mangaIdAttr = $("#manga-chapters-holder").attr("data-id");
    if (mangaIdAttr) {
      try {
        const ajaxReq = {
          url: `${BASE_URL}/wp-admin/admin-ajax.php`,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `action=manga_get_chapters&manga=${mangaIdAttr}`,
        };
        const [_, ajaxBuffer] = await Application.scheduleRequest(ajaxReq);
        const ajaxData = Application.arrayBufferToUTF8String(ajaxBuffer);
        $ = cheerio.load(ajaxData);
      } catch (e) {
        console.error("Erro ao carregar capítulos via ajax:", e);
      }
    }

    if ($("li.chapter-item").length > 0) {
      $("li.chapter-item").each((_, el) => {
        const a = $(el).find("a.chapter-link, a").first();
        const href = a.attr("href")?.trim() ?? "";
        const name = $(el).find(".chapter-number").text().trim() || a.text().trim();
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
    } else {
      $(".chapter-grid-item, .wp-manga-chapter, .chapter-list-item").each((_, el) => {
        const a = $(el).find("a").first();
        const href = a.attr("href")?.trim() ?? "";
        const name =
          $(el).find("strong, .chapter-grid-number, .chapter-name").text().trim() ||
          a.text().trim();
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
    }

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
      ".chapter-images img, img.chapter-image, .reading-content img, .entry-content img, .chapter-content img",
    ).each((_, el) => {
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

export const MangaOnline = new BuscaMangaExtension();
