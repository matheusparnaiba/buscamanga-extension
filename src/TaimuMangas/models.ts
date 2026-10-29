/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const SORT_OPTIONS: Tag[] = [
  { id: "rating", title: "Melhor Avaliados" },
  { id: "updated", title: "Mais Recentes" },
  { id: "added", title: "Data de Adição" },
  { id: "title", title: "Título Alfabético" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Andamento" },
  { id: "finished", title: "Finalizada" },
  { id: "hiatus", title: "Em Hiato" },
  { id: "dropped", title: "Dropada" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manga", title: "Mangá" },
  { id: "manhua", title: "Manhua" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "adulto", title: "Adulto (+18)" },
  { id: "apocaliptico", title: "Apocalíptico" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "crime-policial", title: "Crime / Policial" },
  { id: "culinaria", title: "Culinária" },
  { id: "cultivacao", title: "Cultivação" },
  { id: "drama", title: "Drama" },
  { id: "escolar", title: "Escolar" },
  { id: "esportes", title: "Esportes" },
  { id: "fantasia", title: "Fantasia" },
  { id: "gore", title: "Gore" },
  { id: "guerra", title: "Guerra" },
  { id: "harem", title: "Harém" },
  { id: "historico", title: "Histórico" },
  { id: "isekai", title: "Isekai" },
  { id: "josei", title: "Josei" },
  { id: "mafia", title: "Máfia" },
  { id: "magia", title: "Magia" },
  { id: "misterio", title: "Mistério" },
  { id: "murim", title: "Murim" },
  { id: "psicologia", title: "Psicologia" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Ficção Científica" },
  { id: "seinen", title: "Seinen" },
  { id: "shoujo", title: "Shoujo" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "superpoderes", title: "Superpoderes" },
  { id: "suspense", title: "Suspense" },
  { id: "terror", title: "Terror" },
  { id: "webtoon", title: "Webtoon" },
];

export type TaimuSearchMetadata = {
  sort?: string;
  status?: string;
  type?: string;
  genre?: string;
};

export interface TaimuSeriesSummary {
  identifier: string;
  title: string;
  cover?: string;
  status?: string;
}

export interface TaimuLibraryResponse {
  items: TaimuSeriesSummary[];
  page: number;
  per_page: number;
  total: number;
}

export interface TaimuUpdateSummary {
  series_identifier: string;
  series_title: string;
  series_cover?: string;
  chapter_number?: number | string;
  chapter_published_at?: string;
}

export interface TaimuUpdatesResponse {
  items: TaimuUpdateSummary[];
  has_more: boolean;
}

export interface TaimuNameId {
  name: string;
}

export interface TaimuSeriesDetail {
  identifier: string;
  title: string;
  adult?: boolean;
  artists?: TaimuNameId[];
  authors?: TaimuNameId[];
  cover?: string;
  genres?: TaimuNameId[];
  group?: { name: string };
  status?: string;
  synopsis?: string;
  type?: string;
}

export interface TaimuChapterSummary {
  identifier: string;
  number: number | string;
  published_at?: string;
}

export interface TaimuChapterListResponse {
  items: TaimuChapterSummary[];
  has_more: boolean;
  page: number;
}

export interface TaimuPageInfo {
  url: string;
  number?: number;
}

export interface TaimuChapterDetailResponse {
  pages: TaimuPageInfo[];
}
