/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "view", title: "Mais Lidos (Populares)" },
  { id: "time", title: "Atualizados Recentemente" },
  { id: "created", title: "Adicionados Recentemente" },
];

export const CONTENT_TYPE_OPTIONS: Tag[] = [
  { id: "all", title: "Todos os Formatos" },
  { id: "comic", title: "Quadrinhos (Mangás/Manhwas)" },
  { id: "novel", title: "Novels" },
];

export type ContentTemplateSearchMetadata = {
  orderBy?: string;
  contentType?: string;
};
