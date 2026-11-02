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
  { id: "HIATUS", title: "Hiato" },
  { id: "CANCELLED", title: "Cancelado" },
];

export const GENRE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Gêneros" },
  { id: "ACTION", title: "Ação" },
  { id: "ADVENTURE", title: "Aventura" },
  { id: "COMEDY", title: "Comédia" },
  { id: "DRAMA", title: "Drama" },
  { id: "ECCHI", title: "Ecchi" },
  { id: "FANTASY", title: "Fantasia" },
  { id: "HORROR", title: "Terror" },
  { id: "MAHOU_SHOUJO", title: "Mahou Shoujo" },
  { id: "MECHA", title: "Mecha" },
  { id: "MUSIC", title: "Música" },
  { id: "MYSTERY", title: "Mistério" },
  { id: "PSYCHOLOGICAL", title: "Psicológico" },
  { id: "ROMANCE", title: "Romance" },
  { id: "SCI_FI", title: "Ficção Científica" },
  { id: "SLICE_OF_LIFE", title: "Slice of Life" },
  { id: "SPORTS", title: "Esportes" },
  { id: "SUPERNATURAL", title: "Sobrenatural" },
  { id: "THRILLER", title: "Suspense" },
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

export interface TaiyoTrpcLatestChapter {
  id: string;
  createdAt: string;
  number: number;
  volume?: number | null;
  title?: string | null;
  uploader?: {
    id: string;
    name: string;
  };
  scans?: Array<{
    id: string;
    name: string;
  }>;
  media: {
    id: string;
    coverId?: string;
    mainTitle: string;
  };
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
