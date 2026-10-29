/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "popular", title: "Mais Populares" },
  { id: "update", title: "Últimas Atualizações" },
  { id: "latest", title: "Recém Adicionados" },
  { id: "title", title: "Título (A-Z)" },
  { id: "titlereverse", title: "Título (Z-A)" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "Publishing", title: "Em Lançamento" },
  { id: "Finished", title: "Completo" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "Manga", title: "Mangá" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Manhua", title: "Manhua" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "cultivacao", title: "Cultivação" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "isekai", title: "Isekai" },
  { id: "magia", title: "Magia" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Sci-Fi" },
  { id: "seinen", title: "Seinen" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "webtoon", title: "Webtoon" },
];

export type CapitoonsSearchMetadata = {
  order?: "popular" | "update" | "latest" | "title" | "titlereverse";
  status?: string;
  type?: string;
  genre?: string;
};
