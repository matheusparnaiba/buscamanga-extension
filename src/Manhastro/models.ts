/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "views", title: "Mais Vistos" },
  { id: "updated_at", title: "Últimas Atualizações" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
};
