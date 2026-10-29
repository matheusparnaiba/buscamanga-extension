/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "latestUploadedChapter", title: "Recém Atualizados" },
  { id: "followedCount", title: "Mais Populares" },
  { id: "rating", title: "Melhor Avaliados" },
  { id: "title", title: "Ordem Alfabética" },
];

export const STATUS_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Status" },
  { id: "ongoing", title: "Em Lançamento" },
  { id: "completed", title: "Completo" },
  { id: "hiatus", title: "Em Hiato" },
];

export const RATING_FILTER_OPTIONS: Tag[] = [
  { id: "safe_suggestive", title: "Padrão (Seguro & Sugestivo)" },
  { id: "all", title: "Completo (Livre até Adulto/18+)" },
  { id: "erotica_porn", title: "Apenas Adulto (+18)" },
];

export type MangaDexSearchMetadata = {
  orderBy?: "latestUploadedChapter" | "followedCount" | "rating" | "title";
  status?: string;
  ratingFilter?: string;
};
