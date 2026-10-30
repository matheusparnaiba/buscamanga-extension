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

import { ContentTemplateAdvancedSearchForm, SettingsForm } from "./forms";
import type {
  VegitoonsChapterDetailDto,
  VegitoonsListDto,
  VegitoonsMangaDto,
  VegitoonsSearchMetadata,
} from "./models";
import { MainInterceptor } from "./network";
import type VegitoonsConfig from "./pbconfig";

declare const App: any;

const BASE_URL = "https://vegitoons.black";
const API_URL = "https://api.vegitoons.black";
const CDN_URL = "https://cdn.vegitoons.black";
const SCAN_ID = "1";
const LIMIT_PER_PAGE = 26;

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

function isWpLikePath(src: string): boolean {
  return (
    src.startsWith("uploads/") ||
    src.startsWith("wp-content/") ||
    src.startsWith("manga_") ||
    src.startsWith("WP-manga")
  );
}

function normalizeSlashes(url: string): string {
  return url.replace(/(?<!:)\/{2,}/g, "/");
}

function buildImageUrl(
  path: string,
  src: string | null | undefined,
  width?: number,
  base: string = CDN_URL,
  mime?: string | null,
): string {
  if (!src || src.trim() === "") return "";
  if (src.startsWith("http")) return src;

  if (isWpLikePath(src) || mime) {
    if (src.startsWith("manga_")) {
      return normalizeSlashes(`${base}/wp-content/uploads/WP-manga/data/${src}`);
    }
    if (src.startsWith("WP-manga")) {
      return normalizeSlashes(`${base}/wp-content/uploads/${src}`);
    }
    if (src.startsWith("uploads/")) {
      return normalizeSlashes(`${base}/wp-content/${src}`);
    }
    if (src.startsWith("wp-content/")) {
      return normalizeSlashes(`${base}/${src}`);
    }
    return normalizeSlashes(`${base}/wp-content/uploads/WP-manga/data/${src.replace(/^\/+/, "")}`);
  }

  const query = width ? `?width=${width}` : "";
  return normalizeSlashes(`${base}/${path}/${src}${query}`);
}

function mapStatus(statusName?: string): string {
  switch (statusName?.toLowerCase()) {
    case "em andamento":
    case "ativo":
      return "ongoing";
    case "concluído":
    case "concluido":
      return "completed";
    case "hiato":
      return "hiatus";
    case "cancelado":
      return "cancelled";
    default:
      return "ongoing";
  }
}

export class VegitoonsExtension
  implements
    ExtensionImpl<typeof VegitoonsConfig>,
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
      metadata: { order: "ultima_atualizacao", format: "", status: "" },
    });
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

    let url = "";
    if (section.id === "popular") {
      url = `${API_URL}/obras/ranking?tipo=visualizacoes_geral&limite=${LIMIT_PER_PAGE}&pagina=${page}&gen_id=1`;
    } else {
      url = `${API_URL}/obras/atualizacoes?pagina=${page}&limite=${LIMIT_PER_PAGE}&gen_id=1`;
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url,
        method: "GET",
        headers: {
          "scan-id": SCAN_ID,
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: VegitoonsListDto = JSON.parse(jsonText);
      const obras = data.obras ?? [];

      const items: DiscoverSectionItem[] = [];
      for (const obra of obras) {
        const mangaId = String(obra.obr_id);
        const title = obra.obr_nome || "Sem título";
        const imageUrl = buildImageUrl(
          `scans/${obra.scan_id ?? SCAN_ID}/obras/${obra.obr_id}`,
          obra.obr_imagem,
          300,
          CDN_URL,
        );

        if (section.id === "updates") {
          const latestCap = obra.capitulos?.[0];
          const subtitle = latestCap?.cap_nome || "Novo Capítulo";
          items.push({
            mangaId,
            chapterId: latestCap ? String(latestCap.cap_id) : mangaId,
            title,
            subtitle,
            imageUrl,
            type: "chapterUpdatesCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        } else {
          items.push({
            mangaId,
            title,
            imageUrl,
            type: "prominentCarouselItem",
            contentRating: ContentRating.EVERYONE,
          });
        }
      }

      const totalPages = data.totalPages ?? data.totalPaginas ?? 1;
      const currentPage = data.currentPage ?? data.pagina ?? data.pagina_atual ?? page;
      const hasNextPage = totalPages > currentPage;

      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error(`Erro ao carregar seção ${section.id} no Vegitoons:`, e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<VegitoonsSearchMetadata>,
    metadata?: number,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const searchTitle = query.title?.trim() ?? "";
    const order = query.metadata?.order ?? "ultima_atualizacao";
    const format = query.metadata?.format ?? "";
    const status = query.metadata?.status ?? "";
    const genre = query.metadata?.genre;

    const urlBuilder = new URL(`${API_URL}/obras/buscar`);
    urlBuilder.searchParams.set("limite", String(LIMIT_PER_PAGE));
    urlBuilder.searchParams.set("pagina", String(page));

    if (searchTitle) {
      urlBuilder.searchParams.set("obr_nome", searchTitle);
    }
    if (order) {
      urlBuilder.searchParams.set("orderBy", order);
    }
    if (format) {
      urlBuilder.searchParams.set("formt_id", format);
    }
    if (status) {
      urlBuilder.searchParams.set("stt_id", status);
    }
    if (genre) {
      urlBuilder.searchParams.set("gen_id", genre);
    } else {
      urlBuilder.searchParams.set("todos_generos", "1");
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({
        url: urlBuilder.toString(),
        method: "GET",
        headers: {
          "scan-id": SCAN_ID,
          referer: `${BASE_URL}/`,
        },
      });

      const jsonText = Application.arrayBufferToUTF8String(buffer);
      const data: VegitoonsListDto = JSON.parse(jsonText);
      const obras = data.obras ?? [];

      const items: SearchResultItem[] = [];
      for (const obra of obras) {
        const mangaId = String(obra.obr_id);
        const title = obra.obr_nome || "Sem título";
        const imageUrl = buildImageUrl(
          `scans/${obra.scan_id ?? SCAN_ID}/obras/${obra.obr_id}`,
          obra.obr_imagem,
          300,
          CDN_URL,
        );

        items.push({
          mangaId,
          title,
          imageUrl,
          subtitle: obra.status?.stt_nome ?? undefined,
        });
      }

      const totalPages = data.totalPages ?? data.totalPaginas ?? 1;
      const currentPage = data.currentPage ?? data.pagina ?? data.pagina_atual ?? page;
      const hasNextPage = totalPages > currentPage;

      return {
        items,
        metadata: hasNextPage ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do Vegitoons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const cleanId = mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/obras/${cleanId}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "scan-id": SCAN_ID,
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: VegitoonsMangaDto = JSON.parse(jsonText);

    const title = dto.obr_nome || "Sem título";
    const synopsis = dto.obr_descricao
      ? dto.obr_descricao.replace(/<[^>]*>/g, "").trim()
      : "Sem sinopse disponível.";
    const scanId = dto.scan_id ?? SCAN_ID;
    const thumbnailUrl = buildImageUrl(
      `scans/${scanId}/obras/${dto.obr_id}`,
      dto.obr_imagem,
      300,
      CDN_URL,
    );

    const tags: Tag[] = [];
    const seenTagIds = new Set<string>();
    if (dto.genero?.gen_nome && dto.genero.gen_nome.trim()) {
      const id = sanitizeTagId(dto.genero.gen_nome);
      seenTagIds.add(id);
      tags.push({ id, title: dto.genero.gen_nome.trim() });
    }
    if (dto.tags && Array.isArray(dto.tags)) {
      for (const t of dto.tags) {
        if (t?.tag_nome && t.tag_nome.trim()) {
          const id = sanitizeTagId(t.tag_nome);
          if (!seenTagIds.has(id)) {
            seenTagIds.add(id);
            tags.push({ id, title: t.tag_nome.trim() });
          }
        }
      }
    }

    return {
      mangaId: String(dto.obr_id),
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: [],
        thumbnailUrl,
        synopsis,
        contentRating: ContentRating.EVERYONE,
        status: mapStatus(dto.status?.stt_nome),
        author: "Desconhecido",
        artist: "Desconhecido",
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        artworkUrls: [thumbnailUrl],
        shareUrl: `${BASE_URL}/obra/${dto.obr_id}`,
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const cleanId = sourceManga.mangaId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/obras/${cleanId}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "scan-id": SCAN_ID,
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: VegitoonsMangaDto = JSON.parse(jsonText);
    const capitulos = dto.capitulos ?? [];

    const chapters: Chapter[] = [];
    for (const cap of capitulos) {
      const chapNum = typeof cap.cap_numero === "number" ? cap.cap_numero : 0;
      const locked = cap.cap_liberado === false ? "🔒 " : "";
      const title = `${locked}${cap.cap_nome || `Capítulo ${chapNum}`}`;

      let publishDate: Date | undefined;
      if (cap.cap_criado_em) {
        const parsed = new Date(cap.cap_criado_em);
        if (!isNaN(parsed.getTime())) publishDate = parsed;
      }

      chapters.push({
        chapterId: String(cap.cap_id),
        sourceManga,
        langCode: "PT-BR",
        chapNum,
        title,
        volume: 0,
        publishDate,
      });
    }

    chapters.sort((a, b) => b.chapNum - a.chapNum);
    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const chapterId = chapter.chapterId.replace(/[^0-9]/g, "");
    const url = `${API_URL}/capitulos/${chapterId}`;

    const [_, buffer] = await Application.scheduleRequest({
      url,
      method: "GET",
      headers: {
        "scan-id": SCAN_ID,
        referer: `${BASE_URL}/`,
      },
    });

    const jsonText = Application.arrayBufferToUTF8String(buffer);
    const dto: VegitoonsChapterDetailDto = JSON.parse(jsonText);

    const obraId = dto.obra?.obr_id ?? chapter.sourceManga.mangaId.replace(/[^0-9]/g, "");
    const scanId = dto.obra?.scan_id ?? SCAN_ID;
    const chapNumStr =
      dto.cap_numero !== undefined && dto.cap_numero !== null
        ? String(dto.cap_numero).replace(/\.0$/, "")
        : String(chapter.chapNum).replace(/\.0$/, "");

    const pages: string[] = [];
    const rawPages = dto.cap_paginas ?? [];

    for (const p of rawPages) {
      if (typeof p === "string") {
        const imageUrl = buildImageUrl(
          `scans/${scanId}/obras/${obraId}/capitulos/${chapNumStr}`,
          p,
          undefined,
          CDN_URL,
        );
        if (imageUrl) pages.push(imageUrl);
      } else if (p && typeof p === "object" && p.src) {
        const imageUrl = buildImageUrl(
          `scans/${scanId}/obras/${obraId}/capitulos/${chapNumStr}`,
          p.src,
          undefined,
          CDN_URL,
          p.mime,
        );
        if (imageUrl) pages.push(imageUrl);
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

export const Vegitoons = new VegitoonsExtension();
