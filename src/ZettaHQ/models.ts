/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "hq-hentai", title: "HQ Hentai (Hétero)" },
  { id: "3d-hentai", title: "3D Hentai" },
  { id: "colorido", title: "Colorido" },
  { id: "futanari", title: "Futanari" },
  { id: "traducoes-exclusivas", title: "Traduções Exclusivas" },
  { id: "milf", title: "MILF" },
  { id: "incesto", title: "Incesto" },
];

export type ZettaHQSearchMetadata = {
  category?: string;
};
