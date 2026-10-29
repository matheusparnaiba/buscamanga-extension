/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "updated_at", title: "Mais Recente" },
  { id: "title", title: "Título (A-Z)" },
  { id: "chapters_count", title: "Nº de Capítulos" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "em dia", title: "Em Dia" },
  { id: "em andamento", title: "Em Andamento" },
  { id: "completo", title: "Completo" },
  { id: "cancelado", title: "Cancelado" },
  { id: "hiato", title: "Hiato" },
  { id: "dropado", title: "Dropado" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Manga", title: "Mangá" },
  { id: "Manhua", title: "Manhua" },
  { id: "Webtoon", title: "Webtoon" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  status?: string;
  type?: string;
};

export interface AstraTagDto {
  id: number;
  name?: string | { [key: string]: string };
  slug?: string | { [key: string]: string };
}

export interface AstraComicDto {
  id: number;
  title: string;
  slug: string;
  cover_image?: string | null;
  description?: string | null;
  status?: string | null;
  type?: string | null;
  author?: string | null;
  artist?: string | null;
  chapters_count?: number;
  tags?: AstraTagDto[];
}

export interface AstraComicsResponseDto {
  data: AstraComicDto[];
  current_page: number;
  last_page: number;
}

export interface AstraChapterListDto {
  hasMore: boolean;
  html: string;
}
