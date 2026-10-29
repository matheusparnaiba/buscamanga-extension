/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "latest", title: "Últimas Atualizações" },
  { id: "alphabet", title: "Ordem Alfabética" },
  { id: "rating", title: "Melhor Avaliados" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "historico", title: "Histórico" },
  { id: "isekai", title: "Isekai" },
  { id: "josei", title: "Josei" },
  { id: "magia", title: "Magia" },
  { id: "manhwa", title: "Manhwa" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "romance", title: "Romance" },
  { id: "shoujo", title: "Shoujo" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "vida-escolar", title: "Vida Escolar" },
  { id: "webtoon", title: "Webtoon" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "on-going", title: "Em Lançamento" },
  { id: "end", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "views" | "latest" | "alphabet" | "rating";
  genre?: string;
  status?: string;
};
