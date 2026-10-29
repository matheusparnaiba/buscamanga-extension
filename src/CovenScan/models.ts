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
  { id: "adulto", title: "Adulto (+18)" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "josei", title: "Josei" },
  { id: "manhwa", title: "Manhwa" },
  { id: "maduro", title: "Maduro" },
  { id: "pornhwa", title: "Pornhwa" },
  { id: "romance", title: "Romance" },
  { id: "seinen", title: "Seinen" },
  { id: "smut", title: "Smut" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "webtoon", title: "Webtoon" },
  { id: "yaoi", title: "Yaoi" },
  { id: "yuri", title: "Yuri" },
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
