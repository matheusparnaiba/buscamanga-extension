/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [{ id: "latest", title: "Recentes" }];

export type AnimeXNovelSearchMetadata = {
  order?: "latest";
};
