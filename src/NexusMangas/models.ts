/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "avg_rating.desc.nullslast", title: "Melhor Avaliados" },
  { id: "updated_at.desc", title: "Últimas Atualizações" },
  { id: "created_at.desc", title: "Recém Adicionados" },
  { id: "title.asc", title: "Título (A-Z)" },
];

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "MANHWA", title: "Manhwa" },
  { id: "MANGA", title: "Mangá" },
  { id: "MANHUA", title: "Manhua" },
  { id: "WEBTOON", title: "Webtoon" },
  { id: "NOVEL", title: "Novel" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "RELEASING", title: "Em Lançamento" },
  { id: "COMPLETED", title: "Completo" },
  { id: "HIATUS", title: "Em Hiato" },
  { id: "CANCELLED", title: "Cancelado" },
];

export const DEMOGRAPHIC_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Demografias" },
  { id: "SHOUNEN", title: "Shounen" },
  { id: "SEINEN", title: "Seinen" },
  { id: "SHOUJO", title: "Shoujo" },
  { id: "JOSEI", title: "Josei" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "Ação", title: "Ação" },
  { id: "Aventura", title: "Aventura" },
  { id: "Boy's Love", title: "Boy's Love" },
  { id: "Comédia", title: "Comédia" },
  { id: "Cotidiano", title: "Cotidiano" },
  { id: "Crime", title: "Crime" },
  { id: "Drama", title: "Drama" },
  { id: "Ecchi", title: "Ecchi" },
  { id: "Esportes", title: "Esportes" },
  { id: "Fantasia", title: "Fantasia" },
  { id: "Ficção científica", title: "Ficção científica" },
  { id: "Filosófico", title: "Filosófico" },
  { id: "Garotas Mágicas", title: "Garotas Mágicas" },
  { id: "Girl's Love", title: "Girl's Love" },
  { id: "Hentai", title: "Hentai" },
  { id: "Histórico", title: "Histórico" },
  { id: "Horror", title: "Horror" },
  { id: "Isekai", title: "Isekai" },
  { id: "Mecha", title: "Mecha" },
  { id: "Médico", title: "Médico" },
  { id: "Mistério", title: "Mistério" },
  { id: "Murim", title: "Murim" },
  { id: "Psicológico", title: "Psicológico" },
  { id: "Romance", title: "Romance" },
  { id: "Sistema de jogo", title: "Sistema de jogo" },
  { id: "Slice of Life", title: "Slice of Life" },
  { id: "Super-herói", title: "Super-herói" },
  { id: "Thriller", title: "Thriller" },
  { id: "Tragédia", title: "Tragédia" },
  { id: "Wuxia", title: "Wuxia" },
];

export type NexusMangasSearchMetadata = {
  order?: "avg_rating.desc.nullslast" | "updated_at.desc" | "created_at.desc" | "title.asc";
  type?: string;
  status?: string;
  demographic?: string;
  genre?: string;
};
