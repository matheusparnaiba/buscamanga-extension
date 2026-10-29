/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "recent", title: "Lançamentos Recentes" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "title", title: "Ordem Alfabética (A-Z)" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manga", title: "Mangá" },
  { id: "manhua", title: "Manhua" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Concluído" },
  { id: "hiatus", title: "Em Hiato" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  type?: string;
  status?: string;
};

export interface GeassChapterDto {
  id: string;
  number: number;
  title?: string | null;
  releasedAt?: string | null;
}

export interface GeassWorkDto {
  slug: string;
  title: string;
  cover?: string | null;
  coverLarge?: string | null;
  status?: string | null;
  tags?: string[];
  author?: string | null;
  synopsis?: string | null;
  chapters?: GeassChapterDto[];
}

export interface GeassWorkListDto {
  items: GeassWorkDto[];
  page: number;
  pageCount: number;
  total?: number;
}

export interface GeassApiResponse<T> {
  data: T;
}

export interface GeassChapterPagesDto {
  pages: string[];
}
