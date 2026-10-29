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

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type { MangaDexSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type MangaDexConfig from "./pbconfig";

declare const App: any;

const API_BASE = "https://api.mangadex.org";
const SITE_BASE = "https://mangadex.org";

function getMangaTitle(attributes: any): string {
  if (!attributes || !attributes.title) return "Mangá sem título";
  const titles = attributes.title;
  return (
    titles["pt-br"] ||
    titles.en ||
    titles.ja ||
    titles["ja-ro"] ||
    Object.values(titles)[0] ||
    "Mangá sem título"
  );
}

function getMangaCover(mangaId: string, relationships: any[], title: string): string {
  const coverRel = relationships?.find((r) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  if (fileName) {
    return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;
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

export class MangaDexExtension implements ExtensionImpl<typeof MangaDexConfig> {
  constructor(public cheerioInstance?: any) {
    this.getHomePageSections = this.getHomePageSections.bind(this);
    this.getViewMoreItems = this.getViewMoreItems.bind(this);
  }

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 5,
    bufferInterval: 1,
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
        title: "Últimos Lançamentos em PT-BR",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares no Brasil",
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
    const limit = 20;
    const offset = (page - 1) * limit;

    let orderParam = "order[latestUploadedChapter]=desc";
    if (section.id === "popular") {
      orderParam = "order[followedCount]=desc";
    } else if (section.id === "rating") {
      orderParam = "order[rating]=desc";
    }

    const url = `${API_BASE}/manga?limit=${limit}&offset=${offset}&availableTranslatedLanguage[]=pt-br&${orderParam}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const dataStr = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(dataStr);

    const items: DiscoverSectionItem[] = [];
    const mangaList = data?.data ?? [];

    for (const manga of mangaList) {
      const mangaId = manga.id;
      const title = getMangaTitle(manga.attributes);
      const imageUrl = getMangaCover(mangaId, manga.relationships, title);

      if (section.id === "popular") {
        items.push({
          mangaId,
          title,
          imageUrl,
          type: "prominentCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      } else if (section.id === "rating") {
        items.push({
          mangaId,
          title,
          imageUrl,
          type: "simpleCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      } else {
        items.push({
          mangaId,
          title,
          subtitle: "Capítulos em PT-BR",
          chapterId: mangaId,
          imageUrl,
          type: "chapterUpdatesCarouselItem",
          contentRating: ContentRating.EVERYONE,
        });
      }
    }

    const total = data?.total ?? 0;
    const hasNext = offset + limit < total && mangaList.length > 0;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getAdvancedSearchForm(): Promise<AdvancedSearchForm> {
    return new ContentTemplateAdvancedSearchForm({
      title: "",
      metadata: { orderBy: "latestUploadedChapter" },
    });
  }

  async getSearchResults(
    query: SearchQuery<MangaDexSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const title = query.title?.trim() ?? "";
    const orderBy = query.metadata?.orderBy ?? "latestUploadedChapter";
    const status =
      query.metadata?.status && query.metadata.status !== "all" ? query.metadata.status : "";
    const ratingFilter = query.metadata?.ratingFilter ?? "safe_suggestive";

    let ratings = "&contentRating[]=safe&contentRating[]=suggestive";
    if (ratingFilter === "all") {
      ratings =
        "&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
    } else if (ratingFilter === "erotica_porn") {
      ratings = "&contentRating[]=erotica&contentRating[]=pornographic";
    }

    const titleParam = title ? `&title=${encodeURIComponent(title)}` : "";
    const statusParam = status ? `&status[]=${encodeURIComponent(status)}` : "";
    const orderParam = `order[${orderBy}]=desc`;

    const url = `${API_BASE}/manga?limit=${limit}&offset=${offset}&availableTranslatedLanguage[]=pt-br&${orderParam}${titleParam}${statusParam}${ratings}&includes[]=cover_art`;

    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const dataStr = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(dataStr);

    const items: SearchResultItem[] = [];
    const mangaList = data?.data ?? [];

    for (const manga of mangaList) {
      const mangaId = manga.id;
      const mangaTitle = getMangaTitle(manga.attributes);
      const imageUrl = getMangaCover(mangaId, manga.relationships, mangaTitle);

      items.push({
        mangaId,
        title: mangaTitle,
        imageUrl,
        contentRating: ContentRating.EVERYONE,
      });
    }

    const total = data?.total ?? 0;
    const hasNext = offset + limit < total && mangaList.length > 0;

    return {
      items,
      metadata: hasNext ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const dataStr = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(dataStr);
    const manga = data?.data;

    const attributes = manga?.attributes ?? {};
    const title = getMangaTitle(attributes);
    const imageUrl = getMangaCover(mangaId, manga?.relationships, title);

    const descObj = attributes.description ?? {};
    const synopsis = descObj["pt-br"] || descObj.en || Object.values(descObj)[0] || "";

    const rawStatus = (attributes.status ?? "ongoing").toLowerCase();
    const status = rawStatus === "completed" ? "completed" : "ongoing";

    const authorRel = manga?.relationships?.find(
      (r: any) => r.type === "author" || r.type === "artist",
    );
    const author = authorRel?.attributes?.name ?? "MangaDex";

    const genres: Tag[] = [];
    const tags = attributes.tags ?? [];
    for (const tag of tags) {
      const tagAttrs = tag.attributes?.name ?? {};
      const name = tagAttrs["pt-br"] || tagAttrs.en || Object.values(tagAttrs)[0];
      if (name) {
        genres.push({
          id: sanitizeTagId(name),
          title: name,
        });
      }
    }

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl: imageUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status,
        author,
        tagGroups: [{ id: "genres", title: "Gêneros", tags: genres }],
        artworkUrls: [imageUrl],
        shareUrl: `${SITE_BASE}/title/${mangaId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const chapters: Chapter[] = [];
    const limit = 100;
    let offset = 0;
    let total = 1;

    while (offset < total && chapters.length < 500) {
      const url = `${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=pt-br&order[chapter]=desc&limit=${limit}&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=scanlation_group`;
      const request = { url, method: "GET" };
      const [_, buffer] = await Application.scheduleRequest(request);
      const dataStr = Application.arrayBufferToUTF8String(buffer);
      const data = JSON.parse(dataStr);

      total = data?.total ?? 0;
      const chapterList = data?.data ?? [];
      if (chapterList.length === 0) break;

      for (const ch of chapterList) {
        const chapterId = ch.id;
        const attrs = ch.attributes ?? {};
        const chapNum = attrs.chapter ? parseFloat(attrs.chapter) : 0;
        const chapName = attrs.chapter ? `Capítulo ${attrs.chapter}` : "Capítulo Único";
        const title = attrs.title ? `${chapName} - ${attrs.title}` : chapName;

        const groupRel = ch.relationships?.find((r: any) => r.type === "scanlation_group");
        const groupName = groupRel?.attributes?.name;

        const publishDate = attrs.publishAt ? new Date(attrs.publishAt) : undefined;

        chapters.push({
          chapterId,
          sourceManga,
          langCode: "PT-BR",
          chapNum: isNaN(chapNum) ? 0 : chapNum,
          title: groupName ? `${title} [${groupName}]` : title,
          volume: attrs.volume ? parseFloat(attrs.volume) || 0 : 0,
          publishDate,
        });
      }

      offset += limit;
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const url = `${API_BASE}/at-home/server/${chapter.chapterId}`;
    const request = { url, method: "GET" };
    const [_, buffer] = await Application.scheduleRequest(request);
    const dataStr = Application.arrayBufferToUTF8String(buffer);
    const data = JSON.parse(dataStr);

    const baseUrl = data?.baseUrl;
    const hash = data?.chapter?.hash;
    const fileNames = data?.chapter?.data ?? [];

    const pages = fileNames.map((file: string) => `${baseUrl}/data/${hash}/${file}`);

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

export const MangaDex = new MangaDexExtension();
