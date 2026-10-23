/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "modified", title: "Últimas Atualizações" },
  { id: "date", title: "Mais Recentes" },
  { id: "title", title: "Ordem Alfabética" },
  { id: "id", title: "Padrão" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
};
