/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "avg_rating.desc.nullslast", title: "Melhor Avaliados" },
  { id: "updated_at.desc", title: "Últimas Atualizações" },
  { id: "created_at.desc", title: "Recém Adicionados" },
  { id: "title.asc", title: "Título (A-Z)" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "MANHWA", title: "Manhwa" },
  { id: "MANGA", title: "Mangá" },
  { id: "MANHUA", title: "Manhua" },
  { id: "WEBTOON", title: "Webtoon" },
  { id: "NOVEL", title: "Novel" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "RELEASING", title: "Em Lançamento" },
  { id: "COMPLETED", title: "Completo" },
  { id: "HIATUS", title: "Em Hiato" },
  { id: "CANCELLED", title: "Cancelado" },
];

export const DEMOGRAPHIC_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Demografias" },
  { id: "SHOUNEN", title: "Shounen" },
  { id: "SEINEN", title: "Seinen" },
  { id: "SHOUJO", title: "Shoujo" },
  { id: "JOSEI", title: "Josei" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "Ação", title: "Ação" },
  { id: "Artes Marciais", title: "Artes Marciais" },
  { id: "Aventura", title: "Aventura" },
  { id: "Comédia", title: "Comédia" },
  { id: "Drama", title: "Drama" },
  { id: "Fantasia", title: "Fantasia" },
  { id: "Isekai", title: "Isekai" },
  { id: "Magia", title: "Magia" },
  { id: "Reencarnação", title: "Reencarnação" },
  { id: "Romance", title: "Romance" },
  { id: "Seinen", title: "Seinen" },
  { id: "Shounen", title: "Shounen" },
  { id: "Sobrenatural", title: "Sobrenatural" },
  { id: "Webtoon", title: "Webtoon" },
];

export type NexusMangasSearchMetadata = {
  order?: "avg_rating.desc.nullslast" | "updated_at.desc" | "created_at.desc" | "title.asc";
  type?: string;
  status?: string;
  demographic?: string;
  genre?: string;
};
