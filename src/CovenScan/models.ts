/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "latest", title: "Atualizados Agora" },
  { id: "trending", title: "Em Alta" },
  { id: "new-manga", title: "Mais Novos" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "alphabet", title: "Ordem Alfabética" },
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
  { id: "manhua", title: "Manhua" },
  { id: "manhwa", title: "Manhwa" },
  { id: "romance", title: "Romance" },
  { id: "shounen", title: "Shounen" },
  { id: "sobrenatural", title: "Sobrenatural" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "on-going", title: "Em Progresso" },
  { id: "end", title: "Concluído" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "views" | "latest" | "trending" | "new-manga" | "rating" | "alphabet";
  genre?: string;
  status?: string;
};
