/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "recent", title: "Lançamentos Recentes" },
  { id: "popular", title: "Mais Populares" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "title", title: "Ordem Alfabética (A-Z)" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "hentai", title: "Hentai (+18)" },
  { id: "livre", title: "Livre" },
  { id: "shoujo-romance", title: "Shoujo & Romance" },
  { id: "yaoi", title: "Yaoi (+18)" },
  { id: "nacional", title: "Nacional" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manhua", title: "Manhua" },
  { id: "manga", title: "Mangá" },
  { id: "novel", title: "Novel" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Finalizada" },
  { id: "hiatus", title: "Em Hiato" },
];

export const TAG_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Tags" },
  { id: "acao", title: "Ação" },
  { id: "adulto", title: "Adulto (+18)" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "cultivo", title: "Cultivo" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "isekai", title: "Isekai" },
  { id: "magia", title: "Magia" },
  { id: "misterio", title: "Mistério" },
  { id: "psicologico", title: "Psicológico" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "regressao", title: "Regressão" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Ficção Científica" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "sistema", title: "Sistema" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "superpoderes", title: "Superpoderes" },
  { id: "vida-escolar", title: "Vida Escolar" },
  { id: "webtoon", title: "Webtoon" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  genre?: string;
  type?: string;
  status?: string;
  tag?: string;
};

export interface GeassChapterDto {
  id: string;
  number: number;
  title?: string | null;
  pageCount?: number;
  releasedAt?: string | null;
}

export interface GeassWorkDto {
  id?: string;
  slug: string;
  title: string;
  cover?: string | null;
  coverLarge?: string | null;
  kind?: string | null;
  status?: string | null;
  tags?: string[];
  rating?: number;
  chapterCount?: number;
  isNsfw?: boolean;
  genres?: string[];
  author?: string | null;
  synopsis?: string | null;
  chapters?: GeassChapterDto[];
}

export interface GeassWorkUpdateItemDto {
  work: GeassWorkDto;
  chapters?: GeassChapterDto[];
}

export interface GeassWorkListDto {
  items: GeassWorkDto[];
  page: number;
  pageCount: number;
  total?: number;
}

export interface GeassRecommendationsDto {
  items: GeassWorkDto[];
}

export interface GeassApiResponse<T> {
  data: T;
}

export interface GeassChapterPagesDto {
  pages: string[];
}
