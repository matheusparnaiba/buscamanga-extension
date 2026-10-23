/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "latest", title: "Últimas Atualizações" },
  { id: "alphabet", title: "Ordem Alfabética" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "new-manga", title: "Novos Mangás" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "yuri", title: "Yuri" },
  { id: "shoujo-ai", title: "Shoujo Ai" },
  { id: "romance", title: "Romance" },
  { id: "drama", title: "Drama" },
  { id: "comedia", title: "Comédia" },
  { id: "vida-escolar", title: "Vida Escolar" },
  { id: "fantasia", title: "Fantasia" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "slice-of-life", title: "Slice of Life" },
  { id: "webtoon", title: "Webtoon" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
  genre?: string;
};
