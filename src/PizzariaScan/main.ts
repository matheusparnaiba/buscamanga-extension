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
import type { PizzariaScanSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type PizzariaScanConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://pizzariacomics.com";

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

  const months: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  const dmyMatch = str.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (dmyMatch?.[1] && dmyMatch[2] && dmyMatch[3]) {
    const m = months[dmyMatch[2]];
    if (m !== undefined) {
      return new Date(parseInt(dmyMatch[3], 10), m, parseInt(dmyMatch[1], 10));
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

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export class PizzariaScanExtension implements ExtensionImpl<typeof PizzariaScanConfig> {
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
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "updates",
        title: "Últimas Atualizações",
        type: DiscoverSectionType.chapterUpdates,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const order = section.id === "popular" ? "popular" : "update";
    const url =
      page === 1
        ? `${BASE_URL}/todas-as-obras/?order=${order}`
        : `${BASE_URL}/todas-as-obras/page/${page}/?order=${order}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: DiscoverSectionItem[] = [];
    const seenIds = new Set<string>();

    $("div.w-full.h-full, .grid > div, article, .manga-item").each((_, el) => {
      const linkEl = $(el).find("a[href*='/manga/']").first();
      const href = linkEl.attr("href") || $(el).attr("href");
      if (!href) return;

      const titleEl = $(el).find("h1, h2, h3, .line-clamp-1").first();
      const title =
        titleEl.text().replace(/\s+/g, " ").trim() || linkEl.attr("title")?.trim() || "";
      if (!title) return;

      const img = getImageSrc($(el).find("img").first());
      const idMatch = href.match(/\/manga\/([^/]+)/);
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
            contentRating: ContentRating.MATURE,
          });
        } else {
          const chapText = $(el)
            .find(".text-xs, span.line-clamp-1, .chapter")
            .first()
            .text()
            .trim();
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: chapText || undefined,
            imageUrl:
              img ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(title) +
                "&background=random",
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.MATURE,
          });
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
      metadata: { order: "popular" },
    });
  }

  async getSearchResults(
    query: SearchQuery<PizzariaScanSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const title = query.title?.trim() ?? "";
    const order = query.metadata?.order ?? "popular";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const type = query.metadata?.type && query.metadata.type !== "all" ? query.metadata.type : "";
    const genre =
      query.metadata?.genre && query.metadata.genre !== "all" ? query.metadata.genre : "";

    const params = new URLSearchParams();
    if (title) params.append("title", title);
    if (order) params.append("order", order);
    if (status) params.append("status", status);
    if (type) params.append("type", type);
    if (genre) params.append("genre[]", genre);

    const url =
      page === 1
        ? `${BASE_URL}/todas-as-obras/?${params.toString()}`
        : `${BASE_URL}/todas-as-obras/page/${page}/?${params.toString()}`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);
    const items: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    $("div.w-full.h-full, .grid > div, article, .manga-item").each((_, el) => {
      const linkEl = $(el).find("a[href*='/manga/']").first();
      const href = linkEl.attr("href") || $(el).attr("href");
      if (!href) return;

      const titleEl = $(el).find("h1, h2, h3, .line-clamp-1").first();
      const mangaTitle =
        titleEl.text().replace(/\s+/g, " ").trim() || linkEl.attr("title")?.trim() || "";
      if (!mangaTitle) return;

      const img = getImageSrc($(el).find("img").first());
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
          contentRating: ContentRating.MATURE,
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
      $("h1.text-4xl.font-bold, h1").first().text().trim() || mangaId.replace(/-/g, " ");

    const image = getImageSrc($("img[itemprop=image], [itemprop=image] img, .w-full img").first());
    const thumbnailUrl =
      image ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random";

    const synopsis =
      $(
        "div.text-base.leading-relaxed.mb-6.text-muted-foreground, .entry-content, .description, p.leading-relaxed",
      )
        .first()
        .text()
        .trim() || "";

    let status = "ongoing";
    const statusText = $("div:contains('Status') + div, .status, [itemprop=genre]")
      .text()
      .trim()
      .toLowerCase();
    if (
      statusText.includes("finished") ||
      statusText.includes("completed") ||
      statusText.includes("concluído") ||
      statusText.includes("finalizado")
    ) {
      status = "completed";
    }

    let author = "Desconhecido";
    $("div.grid > div").each((_, el) => {
      const label = $(el).find("strong").text().trim();
      if (label.includes("Autor") || label.includes("Author")) {
        const val = $(el).find("p").text().trim();
        if (val) author = val;
      }
    });

    const genres: Tag[] = [];
    const seenGenres = new Set<string>();

    $("[itemprop=genre], a[href*='/genre/'], a[href*='/genero/']").each((_, el) => {
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
        contentRating: ContentRating.MATURE,
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
    const url = `${BASE_URL}/manga/${slug}/`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const data = Application.arrayBufferToUTF8String(buffer);
    const $ = cheerio.load(data);

    const chapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    const parseChapterItem = ($el: cheerio.Cheerio<any>) => {
      const a = $el.find("a[href]").first();
      const href = a.attr("href")?.trim() ?? "";
      if (!href || seenChapters.has(href)) return;
      seenChapters.add(href);

      const nameEl = $el.find("span.m-0, span.line-clamp-1, span").first();
      const name = nameEl.text().trim() || a.text().trim();
      const numMatch = name.match(/(\d+(?:[.,]\d+)?)/);
      const chapNum = numMatch ? parseFloat(numMatch[1]!.replace(",", ".")) : 0;

      const rawDate = $el.find("span").last().text().trim();
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
    };

    $(
      "#chapter_list.chapter_list_container li, ul.chapter_list_container li, #chapter_list li",
    ).each((_, el) => {
      parseChapterItem($(el));
    });

    const container = $("#chapter_list.chapter_list_container");
    const postId = container.attr("data-post-id");
    const nextBtn = $("button.load-chapters[data-paged]");

    if (postId && nextBtn.length > 0) {
      try {
        let currentPage = 1;
        let hasNext = true;
        while (hasNext && currentPage < 10) {
          currentPage++;
          const ajaxReq = {
            url: `${BASE_URL}/wp-admin/admin-ajax.php`,
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: url,
            },
            body: `action=load_chapters&post_id=${postId}&count=1000&paged=${currentPage}&order=DESC`,
          };
          const [__, ajaxBuf] = await Application.scheduleRequest(ajaxReq);
          const ajaxData = Application.arrayBufferToUTF8String(ajaxBuf);
          const $ajax = cheerio.load(ajaxData);
          const newItems = $ajax("li");
          if (newItems.length === 0) {
            hasNext = false;
          } else {
            newItems.each((_, el) => {
              parseChapterItem($ajax(el));
            });
            const ajaxNextBtn = $ajax("button.load-chapters[data-paged]");
            if (ajaxNextBtn.length === 0) hasNext = false;
          }
        }
      } catch (err) {
        console.error("Erro ao carregar capítulos adicionais via ajax:", err);
      }
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
      "div.reader-area img#imagech, div.reader-area img, .entry-content img, .chapter-images img",
    ).each((_, el) => {
      const src = getImageSrc($(el));
      if (src && src.startsWith("http") && !seenPages.has(src)) {
        seenPages.add(src);
        pages.push(src);
      }
    });

    if (pages.length === 0) {
      const regex = /"image"\s*:\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(data)) !== null) {
        let imgUrl = m[1]?.replace(/\\\//g, "/") ?? "";
        if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl;
        else if (imgUrl.startsWith("/")) imgUrl = BASE_URL + imgUrl;
        if (imgUrl && !seenPages.has(imgUrl)) {
          seenPages.add(imgUrl);
          pages.push(imgUrl);
        }
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

export const PizzariaScan = new PizzariaScanExtension();
