/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "Adulto", title: "Adulto" },
  { id: "Drama", title: "Drama" },
  { id: "Harém", title: "Harém" },
  { id: "Romance", title: "Romance" },
  { id: "Comédia", title: "Comédia" },
  { id: "Ação", title: "Ação" },
  { id: "Fantasia", title: "Fantasia" },
  { id: "Mistério", title: "Mistério" },
  { id: "Isekai", title: "Isekai" },
  { id: "Vida Universitária", title: "Vida Universitária" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Pornhwa", title: "Pornhwa" },
  { id: "Webtoon", title: "Webtoon" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "completed", title: "Completos" },
];

export type BlackoutComicsSearchMetadata = {
  genre?: string;
  status?: string;
};
