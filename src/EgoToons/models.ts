/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "recentes", title: "Mais Recentes" },
  { id: "populares", title: "Mais Populares" },
  { id: "alfabetica", title: "Ordem Alfabética (A-Z)" },
];

export const FORMAT_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Formatos" },
  { id: "1", title: "Manhwa" },
  { id: "2", title: "Mangá" },
  { id: "3", title: "Manhua" },
  { id: "4", title: "Webtoon" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "1", title: "Em Lançamento" },
  { id: "2", title: "Completo" },
  { id: "3", title: "Em Hiato" },
];

export type ContentTemplateSearchMetadata = {
  [key: string]: any;
  orderBy?: string;
  format?: string;
  status?: string;
};

export interface EgoMangaDto {
  id: number;
  nome: string;
  slug?: string;
  imagem?: string | null;
  descricao?: string | null;
  formato_nome?: string | null;
  status_nome?: string | null;
  tags?: { id: number; nome: string }[];
  total_capitulos?: number;
}

export interface EgoPaginationDto {
  hasNextPage?: boolean;
  totalPaginas?: number;
}

export interface EgoMangaListDto {
  obras: EgoMangaDto[];
  pagination?: EgoPaginationDto;
}

export interface EgoMangaDetailsDto {
  obra: EgoMangaDto;
}

export interface EgoChapterDto {
  id: number;
  obra_id: number;
  numero: string;
  numero_key?: string | null;
  titulo?: string | null;
  nome?: string | null;
  criado_em?: string | null;
  total_paginas?: number;
}

export interface EgoChapterListDto {
  capitulos: EgoChapterDto[];
  pagination?: EgoPaginationDto;
}

export interface EgoChapterIndexDto {
  sucesso: boolean;
  capitulo: {
    id: number;
    obra_id: number;
    numero: string;
    numero_key?: string;
    titulo?: string;
    nome?: string;
  };
}

export interface EgoManifestPageDto {
  index: number;
  url: string;
}

export interface EgoChapterManifestDto {
  sucesso?: boolean;
  pages?: EgoManifestPageDto[];
  nextOffset?: number | null;
}
