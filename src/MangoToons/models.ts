/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "populares", title: "Mais Populares" },
  { id: "recentes", title: "Atualizados Recentemente" },
];

export type MangoToonsSearchMetadata = {
  order?: "populares" | "recentes";
};
