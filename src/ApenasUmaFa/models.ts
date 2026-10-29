/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "idols", title: "Idols" },
  { id: "manhwa", title: "Manhwa" },
  { id: "romance", title: "Romance" },
  { id: "shounen-ai", title: "Shounen Ai" },
  { id: "slice-of-life", title: "Slice Of Life" },
  { id: "vida-escolar", title: "Vida Escolar" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "em-lancamento", title: "Em Lançamento" },
  { id: "completo", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  genre?: string;
  status?: string;
};
