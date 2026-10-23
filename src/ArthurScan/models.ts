/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "latest", title: "Últimas Atualizações" },
  { id: "alphabet", title: "Ordem Alfabética" },
  { id: "rating", title: "Melhor Avaliados" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: "views" | "latest" | "alphabet" | "rating";
};
