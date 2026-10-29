/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "adulto", title: "Adulto" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "esporte", title: "Esporte" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "horror", title: "Horror" },
  { id: "isekai", title: "Isekai" },
  { id: "manhua", title: "Manhua" },
  { id: "misterio", title: "Mistério" },
  { id: "musical", title: "Musical" },
  { id: "psicologico", title: "Psicológico" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Sci-Fi" },
  { id: "slice-of-life", title: "Slice of Life" },
  { id: "sobrenatural", title: "Sobrenatural" },
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
