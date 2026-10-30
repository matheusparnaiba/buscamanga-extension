/* SPDX-License-Identifier: GPL-3.0-or-later */
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
import type {
  ContentTemplateSearchMetadata,
  EgoChapterIndexDto,
  EgoChapterListDto,
  EgoChapterManifestDto,
  EgoMangaDetailsDto,
  EgoMangaDto,
  EgoMangaListDto,
} from "./models";
import { MainInterceptor } from "./network";
import type EgoToonsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://egotoons.com";
const API_URL = "https://api.egotoons.com";

function cleanCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  let full = url;
  if (!full.startsWith("http://") && !full.startsWith("https://")) {
    full = `${BASE_URL}${full.startsWith("/") ? "" : "/"}${full}`;
  }
  try {
    full = decodeURI(full);
  } catch {}
  return encodeURI(full).replace(/%2520/g, "%20").replace(/ /g, "%20");
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

export class EgoToonsExtension implements ExtensionImpl<typeof EgoToonsConfig> {
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
      metadata: { orderBy: "recentes", format: "all", status: "all" },
    });
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "updates",
        title: "Capítulos Recentes",
        type: DiscoverSectionType.chapterUpdates,
      },
      {
        id: "popular",
        title: "Mais Populares",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "all",
        title: "Todas as Obras",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let sort = "recentes";
    if (section.id === "popular") {
      sort = "populares";
    }

    const url = `${BASE_URL}/api/obras.js?pagina=${page}&limite=24&ordenarPor=${sort}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: EgoMangaListDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const obras = json.obras ?? [];
      const items: DiscoverSectionItem[] = [];

      for (const obra of obras) {
        const title = obra.nome?.trim() || "Sem título";
        const mangaId = String(obra.id);
        const imageUrl =
          cleanCoverUrl(obra.imagem) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        if (section.id === "updates") {
          items.push({
            mangaId,
            chapterId: mangaId,
            title,
            subtitle: obra.formato_nome || "Atualizado",
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

      const hasNextPage = json.pagination?.hasNextPage ?? false;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção EgoToons ${section.id}:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<ContentTemplateSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const sort = query.metadata?.orderBy || "recentes";
    const params = new URLSearchParams({
      pagina: String(page),
      limite: "24",
      ordenarPor: sort,
    });

    if (query.title && query.title.trim().length > 0) {
      params.set("busca", query.title.trim());
    }

    if (query.metadata?.format && query.metadata.format !== "all") {
      params.set("formato_id", query.metadata.format);
    }

    if (query.metadata?.status && query.metadata.status !== "all") {
      params.set("status_id", query.metadata.status);
    }

    const url = `${BASE_URL}/api/obras.js?${params.toString()}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const json: EgoMangaListDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
      const obras = json.obras ?? [];
      const items: SearchResultItem[] = [];

      for (const obra of obras) {
        const title = obra.nome?.trim() || "Sem título";
        const mangaId = String(obra.id);
        const imageUrl =
          cleanCoverUrl(obra.imagem) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

        items.push({
          mangaId,
          title,
          imageUrl,
          contentRating: ContentRating.EVERYONE,
        });
      }

      const hasNextPage = json.pagination?.hasNextPage ?? false;
      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca EgoToons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const cleanId = mangaId.replace(/[^0-9]/g, "");
    const url = `${BASE_URL}/api/obras/${cleanId}`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const json: EgoMangaDetailsDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
    const obra: EgoMangaDto = json.obra;

    const title = obra.nome?.trim() || "Sem título";
    const thumbnailUrl =
      cleanCoverUrl(obra.imagem) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;

    let synopsis = "";
    if (obra.descricao) {
      const $desc = cheerio.load(obra.descricao);
      synopsis = $desc.text().trim();
    }

    const rawStatus = (obra.status_nome || "").toLowerCase();
    let status = "ongoing";
    if (
      rawStatus.includes("finalizado") ||
      rawStatus.includes("completo") ||
      rawStatus.includes("concluído")
    ) {
      status = "completed";
    }

    const tagList: Tag[] = [];
    if (obra.formato_nome) {
      tagList.push({
        id: sanitizeTagId(obra.formato_nome),
        title: obra.formato_nome,
      });
    }

    if (obra.tags && Array.isArray(obra.tags)) {
      for (const t of obra.tags) {
        if (t.nome) {
          tagList.push({
            id: sanitizeTagId(t.nome),
            title: t.nome,
          });
        }
      }
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
        author: "EgoToons",
        artist: "EgoToons",
        tagGroups: tagList.length > 0 ? [{ id: "genres", title: "Gêneros", tags: tagList }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: `${BASE_URL}/obra/${cleanId}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const cleanId = sourceManga.mangaId.replace(/[^0-9]/g, "");
    const chapters: Chapter[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${BASE_URL}/api/obras/${cleanId}/capitulos.js?pagina=${page}&limite=80&ordenar=desc&fields=list`;
      try {
        const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
        const json: EgoChapterListDto = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        totalPages = json.pagination?.totalPaginas ?? 1;

        const list = json.capitulos ?? [];
        for (const cap of list) {
          const numSlug = cap.numero_key || cap.numero.replace(/\.00?$/, "");
          const chapNum = parseFloat(cap.numero) || 0;
          const title = cap.titulo || cap.nome || `Capítulo ${numSlug}`;
          const chapterIdentifier = `${cleanId}/${numSlug}/${cap.id}`;

          chapters.push({
            chapterId: chapterIdentifier,
            sourceManga,
            langCode: "PT-BR",
            chapNum,
            title,
            volume: 0,
            publishDate: cap.criado_em ? new Date(cap.criado_em) : undefined,
          });
        }

        page++;
      } catch (e) {
        console.error(`Erro ao obter capítulos da obra ${cleanId} (pág ${page}):`, e);
        break;
      }
    }

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const parts = chapter.chapterId.split("/");
    const mangaId = parts[0] || chapter.sourceManga.mangaId.replace(/[^0-9]/g, "");
    const chapterNum = parts[1] || String(chapter.chapNum);
    let chapterId = parts[2] ? parseInt(parts[2], 10) : 0;

    if (!chapterId || isNaN(chapterId)) {
      const indexUrl = `${BASE_URL}/api/obras/${mangaId}/capitulos/${chapterNum}/index.js`;
      const [_, idxBuf] = await Application.scheduleRequest({ url: indexUrl, method: "GET" });
      const idxJson: EgoChapterIndexDto = JSON.parse(Application.arrayBufferToUTF8String(idxBuf));
      chapterId = idxJson.capitulo.id;
    }

    const pages: string[] = [];
    let offset = 0;
    const readerUrl = `${BASE_URL}/obra/${mangaId}/capitulo/${chapterNum}`;

    while (true) {
      const manifestUrl = `${API_URL}/api/leitor/capitulos/${chapterId}/manifest?offset=${offset}&limit=24`;
      const [_, mBuf] = await Application.scheduleRequest({
        url: manifestUrl,
        method: "GET",
        headers: {
          Referer: readerUrl,
        },
      });

      const manifest: EgoChapterManifestDto = JSON.parse(Application.arrayBufferToUTF8String(mBuf));
      const pageList = manifest.pages ?? [];

      for (const p of pageList) {
        if (!p.url) continue;
        const pageUrl = p.url.startsWith("http")
          ? p.url
          : `${API_URL}${p.url.startsWith("/") ? "" : "/"}${p.url}`;
        pages.push(pageUrl);
      }

      if (manifest.nextOffset == null || manifest.nextOffset === offset) {
        break;
      }
      offset = manifest.nextOffset;
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

export const EgoToons = new EgoToonsExtension();
