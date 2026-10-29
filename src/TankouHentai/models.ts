/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "latest", title: "Últimas Atualizações" },
  { id: "alphabet", title: "Ordem Alfabética" },
  { id: "rating", title: "Melhor Avaliados" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "ahegao", title: "Ahegao" },
  { id: "anal", title: "Anal" },
  { id: "bdsm", title: "BDSM" },
  { id: "biquini", title: "Biquíni" },
  { id: "bondage", title: "Bondage" },
  { id: "boquete", title: "Boquete" },
  { id: "bunda-grande", title: "Bunda Grande" },
  { id: "colorido", title: "Colorido" },
  { id: "comedia", title: "Comédia" },
  { id: "creampie", title: "Creampie" },
  { id: "drama", title: "Drama" },
  { id: "fantasia", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "milf", title: "MILF" },
  { id: "peitos-grandes", title: "Peitos Grandes" },
  { id: "romance", title: "Romance" },
  { id: "sem-censura", title: "Sem Censura" },
  { id: "tankoubon", title: "Tankoubon" },
  { id: "traicao", title: "Traição" },
  { id: "virgem", title: "Virgem" },
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
