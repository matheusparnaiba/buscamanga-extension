/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { Tag } from "@paperback/types";

export const CATEGORY_OPTIONS: Tag[] = [
  { id: "all", title: "Todas as Categorias" },
  { id: "category:doujinshi", title: "Doujinshi" },
  { id: "category:one-shot", title: "One-shot" },
  { id: "category:pack-imagens", title: "Pack de Imagens" },
  { id: "tag:peitao", title: "Peitão" },
  { id: "tag:bundao", title: "Bundão" },
  { id: "tag:creampie", title: "Creampie" },
  { id: "tag:milf", title: "Milf" },
  { id: "tag:dupla-penetracao", title: "Dupla Penetração" },
  { id: "tag:ahegao", title: "Ahegão" },
  { id: "tag:anal", title: "Anal" },
  { id: "tag:oral", title: "Oral" },
  { id: "tag:incesto", title: "Incesto" },
  { id: "tag:mae", title: "Mãe" },
  { id: "tag:irmaos", title: "Irmãos" },
  { id: "tag:grupal", title: "Grupal" },
  { id: "tag:virgem", title: "Virgem" },
  { id: "tag:masturbacao", title: "Masturbação" },
  { id: "tag:controle-mental", title: "Controle Mental" },
  { id: "tag:monstrosa", title: "Monstros(a)" },
  { id: "tag:espanhola", title: "Espanhola" },
  { id: "tag:gordinhao", title: "Gordinha(o)" },
  { id: "tag:freiras", title: "Freiras" },
  { id: "tag:gravidez", title: "Gravidez" },
  { id: "tag:fantasia-cosplay", title: "Fantasia / Cosplay" },
  { id: "tag:enfermeirao", title: "Enfermeira(o)" },
  { id: "tag:halloween", title: "Halloween" },
];

export type HentaiSeasonSearchMetadata = {
  category?: string;
};
