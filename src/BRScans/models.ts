/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const ORDER_OPTIONS: Tag[] = [
  { id: "latest", title: "Últimas Atualizações" },
  { id: "top", title: "Mais Populares" },
];

export const VARIANT_OPTIONS: Tag[] = [
  { id: "translated", title: "Traduzido (Português)" },
  { id: "original", title: "Original" },
  { id: "raw", title: "Sem Texto (Raw)" },
];

export type BRScansSearchMetadata = {
  [key: string]: any;
  order?: string;
  variant?: string;
};

export interface BRScansImagesDto {
  original?: string | null;
  translated?: string | null;
  raw?: string | null;
}

export interface BRScansChapterDto {
  id: number;
  title: string;
  created_at?: string | null;
}

export interface BRScansManhwaDto {
  id: number;
  title: string;
  description?: string | null;
  original_title?: string | null;
  thumbnail?: BRScansImagesDto | null;
  chapters?: BRScansChapterDto[];
}

export interface BRScansManhwaPageDto {
  next?: string | null;
  results: BRScansManhwaDto[];
}

export interface BRScansPageDto {
  images: BRScansImagesDto;
}

export interface BRScansChapterPagesDto {
  pages: BRScansPageDto[];
}
