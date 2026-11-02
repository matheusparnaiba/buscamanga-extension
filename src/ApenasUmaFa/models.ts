/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "Em Lançamento", title: "Em Lançamento" },
  { id: "Completo", title: "Completo" },
  { id: "Hiato", title: "Hiato" },
  { id: "Em Breve", title: "Em Breve" },
  { id: "Em Dia", title: "Em Dia" },
  { id: "Dropado", title: "Dropado" },
  { id: "Fim Da Temporada", title: "Fim Da Temporada" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Manhua", title: "Manhua" },
  { id: "Manga", title: "Mangá" },
  { id: "Webtoon", title: "Webtoon" },
  { id: "Novel", title: "Novel" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "Ação", title: "Ação" },
  { id: "Aventura", title: "Aventura" },
  { id: "Comédia", title: "Comédia" },
  { id: "Drama", title: "Drama" },
  { id: "Fantasia", title: "Fantasia" },
  { id: "Gourmet", title: "Gourmet" },
  { id: "Horror", title: "Horror" },
  { id: "Idols", title: "Idols" },
  { id: "Mistério", title: "Mistério" },
  { id: "Romance", title: "Romance" },
  { id: "Sci-Fi", title: "Sci-Fi" },
  { id: "Showbiz", title: "Showbiz" },
  { id: "Shounen ai", title: "Shounen Ai" },
  { id: "Slice Of Life", title: "Slice of Life" },
  { id: "Sobrenatural", title: "Sobrenatural" },
  { id: "Vida Escolar", title: "Vida Escolar" },
  { id: "Game", title: "Game" },
  { id: "Sistema", title: "Sistema" },
  { id: "Transmigração", title: "Transmigração" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  genre?: string;
  status?: string;
  type?: string;
};
