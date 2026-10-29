/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const SORT_OPTIONS: Tag[] = [
  { id: "popular", title: "Mais Populares" },
  { id: "recent", title: "Mais Recentes" },
  { id: "score", title: "Melhor Avaliados" },
  { id: "newest", title: "Lançamentos" },
  { id: "oldest", title: "Mais Antigos" },
  { id: "alphabetical", title: "A-Z" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "manga", title: "Mangá" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manhua", title: "Manhua" },
  { id: "novel", title: "Novel" },
  { id: "webtoon", title: "Webtoon" },
  { id: "one_shot", title: "One Shot" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Andamento" },
  { id: "completed", title: "Concluído" },
  { id: "hiatus", title: "Hiato" },
  { id: "cancelled", title: "Cancelado" },
];

export type HipercoolSearchMetadata = {
  sort?: string;
  type?: string;
  status?: string;
};

export interface HipercoolMangaHitDto {
  id: number;
  slug: string;
  title: string;
  synopsis?: string | null;
  coverUrl?: string | null;
  status?: string | null;
  genres?: string[] | null;
  authors?: string[] | null;
  artists?: string[] | null;
  type?: string | null;
  contentRating?: string | null;
}

export interface HipercoolSearchWrapperDto {
  hits: HipercoolMangaHitDto[];
}

export interface HipercoolChapterDto {
  id: number;
  number: number;
  title?: string | null;
  createdAt: string;
}

export interface HipercoolPageDto {
  pageOrder: number;
  webpUrl: string;
  avifUrl?: string | null;
}
