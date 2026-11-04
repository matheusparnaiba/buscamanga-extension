/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todos" },
  { id: "mangas-hentai", title: "Mangás Hentai" },
  { id: "hentais", title: "Hentais" },
  { id: "doujinshis", title: "Doujinshis" },
  { id: "one-shots", title: "One-Shots" },
];

export type HentaiKaiSearchMetadata = {
  category?: string;
};
