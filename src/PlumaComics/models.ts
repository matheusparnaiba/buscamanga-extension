/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "popular", title: "Mais Populares" },
  { id: "recent", title: "Mais Recentes" },
  { id: "alphabetical", title: "Ordem Alfabética (A-Z)" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  status?: string;
};

export interface PlumaSeriesItemDto {
  id: number | string;
  title: string;
  slug: string;
  status?: string | null;
  coverPath?: string | null;
}

export interface PlumaObrasResponseDto {
  series?: PlumaSeriesItemDto[];
  page?: number;
  totalPages?: number;
}

export interface PlumaChapterDto {
  id: number | string;
  number: number;
  title?: string | null;
  isVipOnly?: boolean;
  publishedAt?: string | null;
}

export interface PlumaChapterListDto {
  chapters?: PlumaChapterDto[];
}

export interface PlumaPageItemDto {
  i: number;
  u: string;
}

export interface PlumaViewerResponseDto {
  pages?: PlumaPageItemDto[];
}
