/* SPDX-License-Identifier: GPL-3.0-or-later */
import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Astratoons",
  description: "Extensão oficial do Astratoons com grande catálogo de manhwas, manhuas e webtoons.",
  version: "1.0.1",
  icon: "icon.png",
  language: "pt-BR",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "matheusparnaiba",
      github: "https://github.com/matheusparnaiba",
    },
  ],
} satisfies ExtensionInfo;
