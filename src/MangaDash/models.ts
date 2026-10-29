/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const SORT_OPTIONS: Tag[] = [
  { id: "recentes", title: "Mais Recentes" },
  { id: "populares", title: "Mais Vistos" },
  { id: "alfabetica", title: "A-Z" },
  { id: "nota", title: "Melhor Avaliados" },
];

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "", title: "Todas as Categorias" },
  { id: "acao", title: "Ação" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "cotidianos", title: "Cotidianos" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "esportes", title: "Esportes" },
  { id: "fantasia", title: "Fantasia" },
  { id: "ficcao-cientifica", title: "Ficção Científica" },
  { id: "harem", title: "Harem" },
  { id: "historico", title: "Histórico" },
  { id: "isekai", title: "Isekai" },
  { id: "misterio", title: "Mistério" },
  { id: "musica", title: "Música" },
  { id: "psicologico", title: "Psicológico" },
  { id: "romance", title: "Romance" },
  { id: "shounen", title: "Shounen" },
  { id: "slice-of-life", title: "Slice of Life" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "suspense", title: "Suspense" },
  { id: "terror", title: "Terror" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Status" },
  { id: "Em Lançamento", title: "Em Lançamento" },
  { id: "Concluído", title: "Concluído" },
  { id: "Em hiato", title: "Em Hiato" },
];

export type MangaDashSearchMetadata = {
  sort?: string;
  category?: string;
  status?: string;
};

export interface MangaItemDto {
  id: number;
  slug: string;
  nome: string;
  capa: string;
  ano_lancamento?: string;
  capitulos_count?: number;
  isPlus18?: boolean;
  nota?: string;
  views?: number;
}

export interface PaginationDto {
  has_next?: boolean;
}

export interface MangaListDto {
  items: MangaItemDto[];
  pagination?: PaginationDto;
}

export interface ChapterDataDto {
  pdfUrl?: string | null;
  pdf_url?: string | null;
  images?: string[] | null;
  imagens?: string[] | null;
  pages?: string[] | null;
  mangaId?: number;
  capituloId?: number;
  mangaNome?: string;
  capituloNumero?: string;
}
