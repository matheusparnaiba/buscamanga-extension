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

export interface HomeMangaDto {
  manga_key: string;
  display_name: string;
  status: string;
  cover_image: string;
}

export interface OneReaderMangaDto {
  manga_key: string;
  display_name: string;
  name?: string;
  japanese_name?: string | null;
  author?: string | null;
  artist?: string | null;
  synopsis?: string | null;
  status: string;
  type: string;
  origin_country?: string;
  year?: number;
  tags?: string[] | null;
  cover_image: string;
  publisher_name?: string | null;
}

export interface SearchDto {
  data: OneReaderMangaDto[];
  page: number;
  totalPages: number;
}

export interface ChapterDto {
  manga_key?: string;
  posted_date?: string;
}

export interface PagesDto {
  pages: string[];
}
