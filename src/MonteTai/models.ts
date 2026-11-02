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
  { id: "harem", title: "Harém" },
  { id: "isekai", title: "Isekai" },
  { id: "magia", title: "Magia" },
  { id: "manhua", title: "Manhua" },
  { id: "manhwa", title: "Manhwa" },
  { id: "reencarnacao", title: "Reencarnação" },
  { id: "romance", title: "Romance" },
  { id: "shounen", title: "Shounen" },
  { id: "sistema", title: "Sistema" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "wuxia", title: "Wuxia" },
  { id: "xianxia", title: "Xianxia" },
  { id: "xuanhuan", title: "Xuanhuan" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "on-going", title: "Em Progresso" },
  { id: "end", title: "Concluído" },
  { id: "canceled", title: "Cancelado" },
  { id: "on-hold", title: "Em Espera" },
  { id: "upcoming", title: "Por Vir" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "views" | "latest" | "trending" | "new-manga" | "rating" | "alphabet";
  genre?: string;
  status?: string;
};
