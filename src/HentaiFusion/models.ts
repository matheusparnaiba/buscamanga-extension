/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todos" },
  { id: "mangas-hentai", title: "Mangás Hentai" },
  { id: "doujinshis", title: "Doujinshis" },
  { id: "hqs-hentai", title: "HQs Hentai" },
];

export type HentaiFusionSearchMetadata = {
  category?: string;
};
