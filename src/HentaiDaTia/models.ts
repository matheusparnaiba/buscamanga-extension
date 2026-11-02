/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "tag:colorido", title: "Colorido" },
  { id: "tag:peitos-grandes", title: "Peitos Grandes" },
  { id: "tag:creampie", title: "Creampie" },
  { id: "tag:boquete", title: "Boquete" },
  { id: "tag:ahegao", title: "Ahegao" },
  { id: "tag:raio-x", title: "Raio X" },
  { id: "tag:milf", title: "MILF" },
  { id: "tag:anal", title: "Anal" },
  { id: "tag:colegial", title: "Colegial" },
  { id: "tag:netorare", title: "Netorare" },
  { id: "tag:incesto", title: "Incesto" },
  { id: "tag:futanari", title: "Futanari" },
  { id: "tag:parodia", title: "Paródia Geral" },
  { id: "parodia:original", title: "Paródia: Original" },
  { id: "parodia:fate-grand-order-jogo", title: "Paródia: Fate/Grand Order" },
  { id: "parodia:touhou-project", title: "Paródia: Touhou Project" },
  { id: "parodia:kantai-collection", title: "Paródia: Kantai Collection" },
  { id: "parodia:the-idolmaster", title: "Paródia: The Idolmaster" },
  { id: "parodia:pokemon", title: "Paródia: Pokemon" },
  { id: "parodia:boku-no-hero-academia", title: "Paródia: Boku no Hero" },
  { id: "parodia:one-piece", title: "Paródia: One Piece" },
  { id: "parodia:dragon-ball", title: "Paródia: Dragon Ball" },
  { id: "parodia:naruto", title: "Paródia: Naruto" },
  { id: "parodia:street-fighter", title: "Paródia: Street Fighter" },
  { id: "parodia:to-love-ru", title: "Paródia: To LOVE-Ru" },
];

export type HentaiDaTiaSearchMetadata = {
  category?: string;
};
