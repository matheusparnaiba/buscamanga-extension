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
  type SourceManga,
  type Tag,
} from "@paperback/types";

import { MangoToonsAdvancedSearchForm, SettingsForm } from "./forms";
import type { MangoToonsSearchMetadata } from "./models";
import { MainInterceptor } from "./network";
import type MangoToonsConfig from "./pbconfig";

const API_URL = "https://api.mangotoons.com/api/v1";

interface ObraDto {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  imagem?: string;
  status?: string;
  tags?: string[];
  autor?: string;
  artista?: string;
  views_total?: number;
  total_capitulos?: number;
  capitulos?: {
    id: number;
    numero: string;
    titulo?: string;
    published_at?: string;
  }[];
}

interface ObraListResponse {
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
  obras: ObraDto[];
}

interface ManifestResponse {
  sucesso: boolean;
  pages: { index: number; url: string }[];
}

export class MangoToonsExtension implements ExtensionImpl<typeof MangoToonsConfig> {
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
    return new MangoToonsAdvancedSearchForm({
      title: "",
      metadata: { order: "populares" },
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
        id: "recentes",
        title: "Atualizados Recentemente",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    const order = section.id === "recentes" ? "recentes" : "populares";
    const url = `${API_URL}/obras?pagina=${page}&limite=24&ordenar=${order}`;

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const text = Application.arrayBufferToUTF8String(buffer);
      const data: ObraListResponse = JSON.parse(text);

      const items: DiscoverSectionItem[] = (data.obras || []).map((o) => ({
        mangaId: String(o.id),
        title: o.nome,
        imageUrl:
          o.imagem ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(o.nome)}&background=random`,
        subtitle: o.total_capitulos ? `${o.total_capitulos} Caps` : undefined,
        type: section.id === "popular" ? "prominentCarouselItem" : "simpleCarouselItem",
      }));

      return {
        items,
        metadata: page < data.total_paginas ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro ao carregar seção " + section.id + " no MangoToons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getSearchResults(
    query: SearchQuery<MangoToonsSearchMetadata>,
    metadata: number | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const order = query.metadata?.order ?? "populares";
    let url = `${API_URL}/obras?pagina=${page}&limite=24&ordenar=${order}`;

    if (query.title) {
      url += `&busca=${encodeURIComponent(query.title)}`;
    }

    try {
      const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
      const text = Application.arrayBufferToUTF8String(buffer);
      const data: ObraListResponse = JSON.parse(text);

      const items: SearchResultItem[] = (data.obras || []).map((o) => ({
        mangaId: String(o.id),
        title: o.nome,
        imageUrl:
          o.imagem ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(o.nome)}&background=random`,
        subtitle: o.status || undefined,
      }));

      return {
        items,
        metadata: page < data.total_paginas ? page + 1 : undefined,
      };
    } catch (e) {
      console.error("Erro na busca do MangoToons:", e);
      return { items: [], metadata: undefined };
    }
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const url = `${API_URL}/obras/${mangaId}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const text = Application.arrayBufferToUTF8String(buffer);
    const data: ObraDto = JSON.parse(text);

    let status = "ONGOING";
    if (
      data.status?.toLowerCase().includes("completo") ||
      data.status?.toLowerCase().includes("conclu")
    ) {
      status = "COMPLETED";
    }

    const tags: Tag[] = (data.tags || []).map((t) => ({
      id: t.toLowerCase().replace(/\s+/g, "-"),
      title: t,
    }));

    return {
      mangaId,
      mangaInfo: {
        primaryTitle: data.nome,
        secondaryTitles: [],
        thumbnailUrl:
          data.imagem ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nome)}&background=random`,
        synopsis: data.descricao || "",
        author: data.autor !== "Autor Desconhecido" ? data.autor : undefined,
        artist: data.artista !== "Arte" ? data.artista : undefined,
        status,
        tagGroups: tags.length > 0 ? [{ id: "genres", title: "Gêneros", tags }] : [],
        contentRating: ContentRating.EVERYONE,
      },
    };
  }

  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const mangaId = sourceManga.mangaId;
    const url = `${API_URL}/obras/${mangaId}`;
    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const text = Application.arrayBufferToUTF8String(buffer);
    const data: ObraDto = JSON.parse(text);

    const chapters: Chapter[] = (data.capitulos || []).map((c) => {
      const chapNum = parseFloat(c.numero) || 0;
      return {
        chapterId: String(c.numero),
        sourceManga,
        title: c.titulo || `Capítulo ${c.numero}`,
        chapNum,
        publishDate: c.published_at ? new Date(c.published_at) : undefined,
        langCode: "pt-br",
      };
    });

    return chapters;
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const mangaId = chapter.sourceManga.mangaId;
    const chapNum = chapter.chapterId;
    const url = `${API_URL}/leitor/obras/${mangaId}/capitulos/${chapNum}/manifest`;

    const [_, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    const text = Application.arrayBufferToUTF8String(buffer);
    const data: ManifestResponse = JSON.parse(text);

    const pages = (data.pages || []).map((p) => {
      if (p.url.startsWith("http")) return p.url;
      return `https://api.mangotoons.com${p.url.startsWith("/") ? "" : "/"}${p.url}`;
    });

    return {
      id: chapter.chapterId,
      mangaId,
      pages,
    };
  }
}

export const MangoToons = new MangoToonsExtension();
