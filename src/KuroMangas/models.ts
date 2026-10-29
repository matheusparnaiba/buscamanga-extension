/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "view_count", title: "Mais Populares" },
  { id: "average_rating", title: "Melhor Avaliados" },
  { id: "created_at", title: "Recém Adicionados" },
  { id: "title_asc", title: "Título (A-Z)" },
  { id: "title_desc", title: "Título (Z-A)" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "isekai", title: "Isekai" },
  { id: "romance", title: "Romance" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "webtoon", title: "Webtoon" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
];

export type KuroMangasSearchMetadata = {
  sort?: "view_count" | "average_rating" | "created_at" | "title_asc" | "title_desc";
  genre?: string;
  status?: string;
};
