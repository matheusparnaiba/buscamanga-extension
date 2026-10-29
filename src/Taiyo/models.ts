/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Tipos" },
  { id: "MANGA", title: "Mangá" },
  { id: "MANHWA", title: "Manhwa" },
  { id: "MANHUA", title: "Manhua" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "RELEASING", title: "Em Lançamento" },
  { id: "FINISHED", title: "Finalizado" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "ACTION", title: "Ação" },
  { id: "ADVENTURE", title: "Aventura" },
  { id: "COMEDY", title: "Comédia" },
  { id: "DRAMA", title: "Drama" },
  { id: "FANTASY", title: "Fantasia" },
  { id: "HORROR", title: "Terror" },
  { id: "MYSTERY", title: "Mistério" },
  { id: "ROMANCE", title: "Romance" },
  { id: "SCI_FI", title: "Ficção Científica" },
  { id: "SLICE_OF_LIFE", title: "Slice of Life" },
  { id: "SUPERNATURAL", title: "Sobrenatural" },
];

export type TaiyoSearchMetadata = {
  type?: string;
  status?: string;
  genre?: string;
};

export interface TaiyoTitleItem {
  title: string;
  language: string;
  priority: number;
  isMainTitle?: boolean;
}

export interface TaiyoMediaItem {
  id: string;
  titles: TaiyoTitleItem[];
  synopsis?: string;
  type?: string;
  status?: string;
  mainCoverId?: string;
  coverId?: string;
  genres?: string[];
}

export interface TaiyoSearchHit {
  id: string;
  titles: TaiyoTitleItem[];
  synopsis?: string;
  type?: string;
  status?: string;
  mainCoverId?: string;
  coverId?: string;
  genres?: string[];
}

export interface TaiyoSearchResult {
  hits: TaiyoSearchHit[];
  estimatedTotalHits?: number;
  limit: number;
  offset: number;
}

export interface TaiyoMultiSearchResponse {
  results: TaiyoSearchResult[];
}

export interface TaiyoTrpcChapter {
  id: string;
  number: number;
  title?: string | null;
  volume?: number;
  createdAt: string;
}

export interface TaiyoTrpcResponse {
  result?: {
    data?: {
      json?: {
        chapters?: TaiyoTrpcChapter[];
        totalPages?: number;
      };
    };
  };
}
