/* SPDX-License-Identifier: GPL-3.0-or-later */
import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Pluma Comics",
  description:
    "Extensão oficial da Pluma Comics com manhwas, manhuas e webtoons traduzidos em português.",
  version: "1.0.0",
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
