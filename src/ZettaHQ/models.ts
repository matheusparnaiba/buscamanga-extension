/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "hq-hentai", title: "HQ Hentai" },
  { id: "3d-hentai", title: "3D Hentai" },
  { id: "colorido", title: "Colorido" },
  { id: "manga-hentai", title: "Mangá Hentai" },
  { id: "futanari", title: "Futanari" },
  { id: "milf", title: "MILF" },
  { id: "sem-censura", title: "Sem Censura" },
  { id: "incesto", title: "Incesto" },
];

export type ZettaHQSearchMetadata = {
  category?: string;
};
