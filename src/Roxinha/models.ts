/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const SORT_OPTIONS: Tag[] = [
  { id: "views", title: "Visualizações" },
  { id: "updated", title: "Última Atualização" },
  { id: "rating", title: "Melhor Avaliação" },
  { id: "title", title: "Título (A-Z)" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Status" },
  { id: "ongoing", title: "Em Andamento" },
  { id: "completed", title: "Concluído" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Tipos" },
  { id: "manga", title: "Mangá" },
  { id: "manhua", title: "Manhua" },
  { id: "manhwa", title: "Manhwa" },
  { id: "webtoon", title: "Webtoon" },
];

export type RoxinhaSearchMetadata = {
  sort?: string;
  order?: "ASC" | "DESC";
  status?: string;
  type?: string;
};

export interface RoxinhaChapterDto {
  id: number;
  chapterNumber?: number | null;
  title?: string | null;
  createdAt?: string | null;
}

export interface RoxinhaMangaDto {
  id: number;
  title: string;
  cover?: string | null;
  author?: string | null;
  description?: string | null;
  status?: string | null;
  genres?: string | null;
  chapters?: RoxinhaChapterDto[];
}

export interface RoxinhaSearchResponseDto {
  mangas?: RoxinhaMangaDto[];
  hasMore?: boolean;
}

export interface RoxinhaTicketDto {
  ticket?: string;
  error?: string;
  requiresLogin?: boolean;
}

export interface RoxinhaChapterDetailsDto {
  pages?: string[];
}
