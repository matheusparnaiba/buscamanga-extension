/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "popular", title: "Mais Lidos (Popular)" },
  { id: "updates", title: "Atualizações Recentes" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
};
