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
  { id: "gore", title: "Gore" },
  { id: "manga", title: "Mangá" },
  { id: "one-shot", title: "One-shot" },
  { id: "psicologico", title: "Psicológico" },
  { id: "romance", title: "Romance" },
  { id: "seinen", title: "Seinen" },
  { id: "terror", title: "Terror" },
  { id: "yaoi", title: "Yaoi" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ativo", title: "Em Lançamento" },
  { id: "completo", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  genre?: string;
  status?: string;
};
