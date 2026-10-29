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

const BASE_URL = "https://acervohentai.com";

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

  src = src.trim().replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, "$1");
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = BASE_URL + src;
  return src;
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

  const slashMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    return new Date(
      parseInt(slashMatch[3], 10),
      parseInt(slashMatch[2], 10) - 1,
      parseInt(slashMatch[1], 10),
    );
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export class AcervoHentaiExtension implements ExtensionImpl<typeof ContentTemplateConfig> {
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
      {
        id: "rating",
        title: "Melhor Avaliados",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;

    let url: string;
    if (section.id === "popular") {
      url =
        page === 1
          ? `${BASE_URL}/manhwa/?m_orderby=views`
          : `${BASE_URL}/manhwa/page/${page}/?m_orderby=views`;
    } else if (section.id === "rating") {
      url =
        page === 1
          ? `${BASE_URL}/manhwa/?m_orderby=rating`
          : `${BASE_URL}/manhwa/page/${page}/?m_orderby=rating`;
    } else {
      url =
        page === 1
          ? `${BASE_URL}/manhwa/?m_orderby=latest`
          : `${BASE_URL}/manhwa/page/${page}/?m_orderby=latest`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $(".page-item-detail, .c-tabs-item__content, .manga-item").each((_, el) => {
      const titleEl = $(el).find(".post-title a, .item-thumb a, h3 a, h2 a").first();
      const title = titleEl.attr("title")?.trim() || titleEl.text().replace(/\s+/g, " ").trim();

      const linkEl = $(el)
        .find(".post-title a, .item-thumb a, a[href*='/manhwa/'], a[href*='/manga/']")
        .first();
      const href = linkEl.attr("href");
      const img = getImageSrc($(el).find("img").first());

      if (href && title) {
        const idMatch = href.match(/\/(?:manhwa|manga)\/([^/]+)/);
        const mangaId = idMatch ? (idMatch[1] as string) : href;

        if (!seenIds.has(mangaId)) {
          seenIds.add(mangaId);

          if (section.id === "popular") {
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
          } else if (section.id === "rating") {
            items.push({
              mangaId,
              title,
              imageUrl:
                img ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(title) +
                  "&background=random",
              type: "simpleCarouselItem",
              contentRating: ContentRating.EVERYONE,
            });
          } else {
            const chapEl = $(el)
              .find(".wp-manga-chapter a, .chapter-item a, .list-chapter a")
              .first();
            const chapHref = chapEl.attr("href");
            const chapName = chapEl.text().replace(/\s+/g, " ").trim();

            let chapterId = mangaId;
            if (chapHref) {
              const chapMatch = chapHref.match(/\/(?:manhwa|manga)\/[^/]+\/([^/]+)/);
              if (chapMatch) chapterId = chapMatch[1] as string;
            }

            items.push({
              mangaId,
              title,
              subtitle: chapName,
              chapterId,
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
      }
    });

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "latest" },
    });
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const orderBy = query.metadata?.orderBy ?? "latest";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";

    let url: string;
    if (title) {
      url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(title)}&post_type=wp-manga&m_orderby=${orderBy}`;
    } else if (genre) {
      url = `${BASE_URL}/tag-manhwa/${encodeURIComponent(genre)}/page/${page}/?m_orderby=${orderBy}`;
    } else {
      url = `${BASE_URL}/manhwa/page/${page}/?m_orderby=${orderBy}`;
    }

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $(".page-item-detail, .c-tabs-item__content, .manga-item").each((_, el) => {
      const titleEl = $(el).find(".post-title a, .item-thumb a, h3 a, h2 a").first();
      const mangaTitle =
        titleEl.attr("title")?.trim() || titleEl.text().replace(/\s+/g, " ").trim();

      const linkEl = $(el)
        .find(".post-title a, .item-thumb a, a[href*='/manhwa/'], a[href*='/manga/']")
        .first();
      const href = linkEl.attr("href");
      const img = getImageSrc($(el).find("img").first());

      if (href && mangaTitle) {
        const idMatch = href.match(/\/(?:manhwa|manga)\/([^/]+)/);
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

    return {
      items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${BASE_URL}/manhwa/${mangaId}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const title =
      $(".post-title h1, .post-title h3, h1").first().text().trim() || mangaId.replace(/-/g, " ");
    const image = getImageSrc($(".summary_image img, .tab-summary img").first());
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $(".description-summary .summary__content, .summary__content, .manga-excerpt, .post-content")
        .first()
        .text()
        .trim() || "";

    let status = "ongoing";
    const statusText = $(
      ".post-status .summary-content, .summary-heading:contains('Status') + .summary-content",
    )
      .text()
      .trim()
      .toLowerCase();
    if (statusText.includes("completo") || statusText.includes("completed")) {
      status = "completed";
    }

    const author =
      $(
        ".author-content a, .summary-heading:contains('Autor') + .summary-content, .summary-heading:contains('Author') + .summary-content",
      )
        .first()
        .text()
        .trim() || "Desconhecido";

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $(".genres-content a, .tags-content a, a[href*='/tag-manhwa/']").each((_, el) => {
      const g = $(el)
        .text()
        .replace(/\s*\(\d+\)\s*$/, "")
        .trim();
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
        tagGroups: [{ id: "genres", title: "Categorias", tags: genres }],
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
        url: `${BASE_URL}/manhwa/${slug}/ajax/chapters/`,
        method: "POST",
      };
      const [_, ajaxBuffer] = await Application.scheduleRequest(ajaxReq);
      chaptersData = Application.arrayBufferToUTF8String(ajaxBuffer);
    } catch {
      // Falha silenciosa de ajax direta
    }

    let $ = cheerio.load(chaptersData);

    if ($("li.wp-manga-chapter").length === 0) {
      const pageReq = {
        url: `${BASE_URL}/manhwa/${slug}/`,
        method: "GET",
      };
      const [_, pageBuf] = await Application.scheduleRequest(pageReq);
      const pageData = Application.arrayBufferToUTF8String(pageBuf);
      const $page = cheerio.load(pageData);

      const mangaIdAttr =
        $page("#manga-chapters-holder").attr("data-id") ||
        $page(".wp-manga-action-button[data-post]").attr("data-post");
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
        } catch {
          $ = $page;
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

    $(".reading-content img, .entry-content img, .chapter-images img, .page-break img").each(
      (_, el) => {
        const src = getImageSrc($(el));
        if (src && src.startsWith("http") && !seenPages.has(src)) {
          seenPages.add(src);
          pages.push(src);
        }
      },
    );

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
              items: [],
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

export const AcervoHentai = new AcervoHentaiExtension();
