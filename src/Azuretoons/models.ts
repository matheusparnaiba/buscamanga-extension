/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "latest", title: "Últimas Atualizações" },
  { id: "views", title: "Mais Vistos" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "alphabet", title: "Ordem Alfabética" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "cultivacao", title: "Cultivação" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "isekai", title: "Isekai" },
  { id: "manhwa", title: "Manhwa" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "romance", title: "Romance" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "webtoon", title: "Webtoon" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
  { id: "hiatus", title: "Em Hiato" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "views" | "latest" | "alphabet" | "rating";
  genre?: string;
  status?: string;
};

export interface AzureChapterDto {
  id?: number | string;
  num?: number | string;
  chapterNumber?: number | string;
  title?: string | null;
  chapterTitle?: string | null;
  releaseDate?: string | null;
  createdAt?: string | null;
  language?: string | null;
}

export interface AzureObraDto {
  id?: number | string;
  title: string;
  slug: string;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  synopsis?: string | null;
  description?: string | null;
  status?: string | null;
  type?: string | null;
  tipo?: string | null;
  genres?: string[];
  originalAuthor?: string | null;
  artist?: string | null;
  views?: number;
  viewCount?: number;
  rating?: number;
  chapters?: AzureChapterDto[];
}

export interface AzureChapterReadDto {
  id?: number | string;
  chapterNumber?: number | string;
  title?: string | null;
  images?: string[];
  pages?: string[];
}
