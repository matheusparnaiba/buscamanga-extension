/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "isekai", title: "Isekai" },
  { id: "magia", title: "Magia" },
  { id: "manga", title: "Mangá" },
  { id: "manhwa", title: "Manhwa" },
  { id: "romance", title: "Romance" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  genre?: string;
  status?: string;
};
