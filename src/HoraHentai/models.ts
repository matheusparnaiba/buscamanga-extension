/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "doujinshi", title: "Doujinshi" },
  { id: "manga-hentai", title: "Mangá Hentai" },
  { id: "comics", title: "Comics" },
  { id: "hentai-sem-censura", title: "Sem Censura" },
  { id: "colorido", title: "Colorido" },
  { id: "3d", title: "3D" },
];

export type HoraHentaiSearchMetadata = {
  category?: string;
};
