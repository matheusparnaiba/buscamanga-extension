/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "az", title: "A-Z" },
  { id: "recent", title: "Atualizados recentemente" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Status" },
  { id: "Em Lançamento", title: "Em Lançamento" },
  { id: "Completo", title: "Completo" },
  { id: "Hiatus", title: "Hiato" },
  { id: "Cancelado", title: "Cancelado" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Tipos" },
  { id: "Mangá", title: "Mangá" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Manhua", title: "Manhua" },
  { id: "Webtoon", title: "Webtoon" },
  { id: "Novel", title: "Novel" },
];

export type OneReaderSearchMetadata = {
  order?: string;
  status?: string;
  type?: string;
  genre?: string;
};

export interface OneReaderHomeUpdateItem {
  id: string;
  slug: string;
  title: string;
  synopsis?: string | null;
  status?: string;
  contentType?: string;
  coverUrl: string;
  totalChapters?: number;
  latestChapterNumber?: number;
  latestChapterAt?: string;
  chapters?: Array<{
    number: number;
    postedAt?: string;
  }>;
}

export interface OneReaderUpdatesResponse {
  items: OneReaderHomeUpdateItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface OneReaderCatalogWork {
  id: string;
  slug: string;
  title: string;
  originalName?: string | null;
  nativeTitle?: string | null;
  englishTitle?: string | null;
  portugueseTitle?: string | null;
  author?: string | null;
  artist?: string | null;
  synopsis?: string | null;
  status?: string;
  type?: string;
  genres?: string[];
  coverUrl: string;
  totalChapters?: number;
  latestChapterNumber?: number;
  latestChapterAt?: string;
  publisher?: string | null;
  releaseYear?: number;
}

export interface OneReaderCatalogResponse {
  works: OneReaderCatalogWork[];
}

export interface OneReaderSearchResponse {
  works: OneReaderCatalogWork[];
}

export interface OneReaderChapterDto {
  id: string;
  number: number;
  title?: string | null;
  pageCount?: number;
  isPremium?: boolean;
  postedAt?: string;
}

export interface OneReaderWorkDetailResponse {
  work: OneReaderCatalogWork;
  chapters: OneReaderChapterDto[];
}

export interface OneReaderChapterDetailResponse {
  chapter: {
    id: string;
    number: number;
    title?: string | null;
    pageCount?: number;
    pages: string[];
  };
}
