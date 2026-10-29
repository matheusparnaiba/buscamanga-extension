/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "MANGA", title: "Mangá" },
  { id: "MANHWA", title: "Manhwa" },
  { id: "MANHUA", title: "Manhua" },
  { id: "NOVEL", title: "Novel" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ONGOING", title: "Em Andamento" },
  { id: "COMPLETE", title: "Completo" },
  { id: "HIATUS", title: "Hiato" },
  { id: "CANCELLED", title: "Cancelado" },
];

export const NSFW_OPTIONS: Tag[] = [
  { id: "all", title: "Todos" },
  { id: "false", title: "Ocultar NSFW" },
  { id: "true", title: "Apenas NSFW" },
];

export type YomuSearchMetadata = {
  type?: string;
  status?: string;
  nsfw?: string;
};

export interface YomuSearchMangaDto {
  id: number;
  slug: string;
  title: string;
  cover: string;
}

export interface YomuSearchResponse {
  mangas: YomuSearchMangaDto[];
  pages: number;
}

export interface YomuTagDto {
  name: string;
}

export interface YomuMangaDto {
  id: number;
  slug: string;
  title: string;
  cover: string;
  status?: string;
  description?: string;
  authors?: string[];
  artists?: string[];
  genres?: YomuTagDto[];
  tags?: YomuTagDto[];
}

export interface YomuDetailsResponse {
  manga: YomuMangaDto;
}

export interface YomuChapterDto {
  id?: number;
  chapter: string;
  volume?: number;
  title?: string;
  uploaded_at?: string;
}

export interface YomuChaptersResponse {
  chapters: YomuChapterDto[];
}

export interface YomuLatestResponse {
  medias: YomuMangaDto[];
}
