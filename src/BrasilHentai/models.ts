/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "colorido", title: "Colorido" },
  { id: "3d-hentai-hd", title: "3D (Hentai HD)" },
  { id: "hentai", title: "Hentai Geral" },
  { id: "desenho-porno", title: "Desenho Pornô" },
  { id: "antigas-hentai-old-school", title: "Old School" },
  { id: "futanari-hentay", title: "Futanari" },
  { id: "familia-sacana", title: "Família Sacana" },
  { id: "hentai-de-naruto", title: "Naruto" },
  { id: "dragon-ball-hentai", title: "Dragon Ball" },
  { id: "one-piece-hentai", title: "One Piece" },
  { id: "demon-slayer-hentai", title: "Demon Slayer" },
  { id: "boku-no-hero-academia-hentai", title: "Boku no Hero" },
];

export type BrasilHentaiSearchMetadata = {
  category?: string;
};
