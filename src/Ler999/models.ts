/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "published", title: "Mais Recentes" },
  { id: "updated", title: "Últimas Atualizações" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "Manhua", title: "Manhua" },
  { id: "Manhwa", title: "Manhwa" },
  { id: "Manga", title: "Mangá" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "Ongoing", title: "Em Lançamento" },
  { id: "Hiatus", title: "Em Hiato" },
  { id: "Dropped", title: "Cancelado / Dropado" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "Action", title: "Ação" },
  { id: "Adventure", title: "Aventura" },
  { id: "Comedy", title: "Comédia" },
  { id: "Cultivo", title: "Cultivo" },
  { id: "Drama", title: "Drama" },
  { id: "Ecchi", title: "Ecchi" },
  { id: "Fantasy", title: "Fantasia" },
  { id: "Harem", title: "Harém" },
  { id: "Magic", title: "Magia" },
  { id: "Martial Arts", title: "Artes Marciais" },
  { id: "Mecha", title: "Mecha" },
  { id: "Medicinal", title: "Medicinal" },
  { id: "Military", title: "Militar" },
  { id: "Mystery", title: "Mistério" },
  { id: "Romance", title: "Romance" },
  { id: "School Life", title: "Vida Escolar" },
  { id: "Sci-Fi", title: "Ficção Científica" },
  { id: "Seinen", title: "Seinen" },
  { id: "Shounen", title: "Shounen" },
  { id: "Supernatural", title: "Sobrenatural" },
  { id: "Survival", title: "Sobrevivência" },
  { id: "Tragedy", title: "Tragédia" },
  { id: "Video Games", title: "Videogames" },
  { id: "VR", title: "Realidade Virtual" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "published" | "updated";
  type?: string;
  genre?: string;
  status?: string;
};
