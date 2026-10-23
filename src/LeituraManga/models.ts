/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "view", title: "Mais Lidos (Populares)" },
  { id: "time", title: "Últimas Atualizações" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
};
