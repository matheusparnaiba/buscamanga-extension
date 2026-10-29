/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "ultima_atualizacao", title: "Última atualização" },
  { id: "criacao", title: "Lançamentos" },
  { id: "visualizacoes_geral", title: "Mais Visualizadas" },
  { id: "rating", title: "Melhor avaliação" },
  { id: "nome", title: "A-Z" },
];

export const FORMAT_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Formatos" },
  { id: "1", title: "Manhwa" },
  { id: "2", title: "Manhua" },
  { id: "3", title: "Mangá" },
  { id: "4", title: "Novel" },
  { id: "5", title: "Nacional" },
  { id: "7", title: "Anime" },
  { id: "19", title: "One Shot" },
  { id: "22", title: "Livre" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "", title: "Todos os Status" },
  { id: "1", title: "Em Andamento" },
  { id: "2", title: "Concluído" },
  { id: "3", title: "Hiato" },
  { id: "4", title: "Cancelado" },
];

export type VegitoonsSearchMetadata = {
  order?: string;
  format?: string;
  status?: string;
  genre?: string;
};

export interface VegitoonsChapterSimpleDto {
  cap_id: number;
  cap_nome: string;
  cap_numero?: number | null;
  cap_criado_em?: string | null;
  cap_liberado?: boolean;
}

export interface VegitoonsTagDto {
  tag_nome?: string;
}

export interface VegitoonsGenreDto {
  gen_nome?: string;
}

export interface VegitoonsStatusDto {
  stt_nome?: string;
}

export interface VegitoonsMangaDto {
  obr_id: number;
  obr_nome: string;
  obr_descricao?: string | null;
  obr_imagem?: string | null;
  genero?: VegitoonsGenreDto | null;
  tags?: VegitoonsTagDto[];
  status?: VegitoonsStatusDto | null;
  scan_id?: number;
  capitulos?: VegitoonsChapterSimpleDto[];
}

export interface VegitoonsListDto {
  obras: VegitoonsMangaDto[];
  currentPage?: number | null;
  totalPages?: number;
  totalPaginas?: number;
  pagina?: number;
  pagina_atual?: number;
}

export interface VegitoonsPageSrcDto {
  src: string;
  mime?: string | null;
}

export interface VegitoonsChapterDetailDto {
  cap_id: number;
  cap_nome: string;
  cap_numero?: number | null;
  cap_paginas?: (VegitoonsPageSrcDto | string)[];
  obra?: VegitoonsMangaDto | null;
}
