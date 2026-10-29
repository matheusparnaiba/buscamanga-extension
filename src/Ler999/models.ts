/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "action", title: "Ação" },
  { id: "adventure", title: "Aventura" },
  { id: "comedy", title: "Comédia" },
  { id: "cultivo", title: "Cultivo" },
  { id: "drama", title: "Drama" },
  { id: "ecchi", title: "Ecchi" },
  { id: "fantasy", title: "Fantasia" },
  { id: "harem", title: "Harém" },
  { id: "manhua", title: "Manhua" },
  { id: "manhwa", title: "Manhwa" },
  { id: "martial-arts", title: "Artes Marciais" },
  { id: "mystery", title: "Mistério" },
  { id: "romance", title: "Romance" },
  { id: "sci-fi", title: "Sci-Fi" },
  { id: "seinen", title: "Seinen" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  genre?: string;
  status?: string;
};
