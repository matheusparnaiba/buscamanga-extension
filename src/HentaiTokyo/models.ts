/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "mangas-hentai", title: "Mangás Hentai" },
  { id: "hq-hentai", title: "HQ Hentai" },
  { id: "3d-hentai", title: "3D Hentai" },
  { id: "colorido", title: "Colorido" },
  { id: "futanari", title: "Futanari" },
  { id: "milf", title: "MILF" },
  { id: "incesto", title: "Incesto" },
  { id: "sem-censura", title: "Sem Censura" },
  { id: "yuri", title: "Yuri" },
  { id: "tentaculos", title: "Tentáculos" },
];

export type HentaiTokyoSearchMetadata = {
  category?: string;
};
