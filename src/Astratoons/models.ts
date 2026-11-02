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

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "crime", title: "Crime" },
  { id: "cultivo", title: "Cultivo" },
  { id: "danca", title: "Dança" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "esporte", title: "Esporte" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "historico", title: "Histórico" },
  { id: "isekai", title: "Isekai" },
  { id: "iskai", title: "Iskai" },
  { id: "magia", title: "Magia" },
  { id: "misterio", title: "Mistério" },
  { id: "monstros", title: "Monstros" },
  { id: "murim", title: "Murim" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "regressao", title: "Regressão" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Sci-Fi" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "silence", title: "Silence" },
  { id: "slice-of-life", title: "Slice of Life" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "super-poderes", title: "Super Poderes" },
  { id: "suspense", title: "Suspense" },
  { id: "tragedia", title: "Tragédia" },
  { id: "troca-de-genero", title: "Troca de Gênero" },
  { id: "viagem-no-tempo", title: "Viagem no Tempo" },
  { id: "vida-cotidiana", title: "Vida Cotidiana" },
  { id: "vida-escolar", title: "Vida Escolar" },
  { id: "zumbis", title: "Zumbis" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  status?: string;
  type?: string;
  genre?: string;
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
