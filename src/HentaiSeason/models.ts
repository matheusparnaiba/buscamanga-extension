/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "doujinshi", title: "Doujinshi" },
  { id: "one-shot", title: "One-shot" },
  { id: "pack-imagens", title: "Pack de Imagens" },
  { id: "manga-hentai", title: "Mangá Hentai" },
  { id: "comic", title: "Comic" },
  { id: "colorido", title: "Colorido" },
  { id: "3d", title: "3D" },
  { id: "sem-censura", title: "Sem Censura" },
  { id: "cosplay", title: "Cosplay" },
];

export type HentaiSeasonSearchMetadata = {
  category?: string;
};
