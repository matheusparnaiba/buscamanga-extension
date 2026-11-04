/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "latest", title: "Mais Recentes" },
  { id: "popular", title: "Mais Populares" },
];

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "tag/hentai-sem-censura", title: "Sem Censura" },
  { id: "tag/doujinshi", title: "Doujinshis" },
  { id: "tag/comics", title: "Comics & HQs" },
  { id: "tag/one-shot", title: "One-shots" },
  { id: "tag/hentai-3d", title: "Hentai 3D" },
];

export type UniversoHentaiSearchMetadata = {
  order?: "latest" | "popular";
  category?: string;
};
