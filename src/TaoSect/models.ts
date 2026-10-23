/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "modified", title: "Últimas Atualizações" },
  { id: "date", title: "Mais Recentes" },
  { id: "title", title: "Ordem Alfabética" },
  { id: "id", title: "Padrão" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "24", title: "Ação" },
  { id: "21", title: "Artes Marciais" },
  { id: "25", title: "Aventura" },
  { id: "26", title: "Comédia" },
  { id: "66", title: "Culinária" },
  { id: "22", title: "Drama" },
  { id: "12", title: "Ecchi" },
  { id: "28", title: "Seinen" },
  { id: "84", title: "Adulto" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
  genre?: string;
};
