/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Populares" },
  { id: "modified", title: "Mais Recentes" },
  { id: "trending", title: "Tendências" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "new-manga", title: "Novos Mangás" },
  { id: "alphabet", title: "Ordem Alfabética (A-Z)" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "manga", title: "Mangá" },
  { id: "manhwa", title: "Manhwa" },
  { id: "manhua", title: "Manhua" },
  { id: "hq", title: "HQ" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "acao", title: "Ação" },
  { id: "adulto", title: "Adulto" },
  { id: "anime", title: "Anime" },
  { id: "artes-marciais", title: "Artes Marciais" },
  { id: "aventura", title: "Aventura" },
  { id: "comedia", title: "Comédia" },
  { id: "cotidiano", title: "Cotidiano" },
  { id: "doujinshi", title: "Doujinshi" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "esporte", title: "Esporte" },
  { id: "fantasia", title: "Fantasia" },
  { id: "gender-bender", title: "Gender Bender" },
  { id: "harem", title: "Harém" },
  { id: "historico", title: "Histórico" },
  { id: "horror", title: "Horror" },
  { id: "hq", title: "HQ" },
  { id: "josei", title: "Josei" },
  { id: "livro-literatura-e-ficcao", title: "Livro (Literatura e Ficção)" },
  { id: "livro-romance", title: "Livro (Romance)" },
  { id: "maduro", title: "Maduro" },
  { id: "mecha", title: "Mecha" },
  { id: "misterio", title: "Mistério" },
  { id: "one-shot", title: "One-shot" },
  { id: "psicologico", title: "Psicológico" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Sci-fi" },
  { id: "seinen", title: "Seinen" },
  { id: "shoujo", title: "Shoujo" },
  { id: "shoujo-ai", title: "Shoujo-Ai" },
  { id: "shounen", title: "Shounen" },
  { id: "shounen-ai", title: "Shounen-Ai" },
  { id: "sobrenatural", title: "Sobrenatural" },
  { id: "tragedia", title: "Tragédia" },
  { id: "vida-escolar", title: "Vida Escolar" },
  { id: "video-game", title: "Video Game" },
  { id: "yuri", title: "Yuri" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "on-going", title: "Em Lançamento" },
  { id: "end", title: "Completo" },
  { id: "canceled", title: "Cancelado" },
  { id: "on-hold", title: "Em Espera" },
];

export type ContentTemplateSearchMetadata = {
  type?: string;
  genre?: string;
  status?: string;
  orderBy?: string;
};
