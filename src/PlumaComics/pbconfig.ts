/* SPDX-License-Identifier: GPL-3.0-or-later */
import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Pluma Comics",
  description:
    "Extensão oficial da Pluma Comics especializada em manhuas, cultivação e artes marciais.",
  version: "1.0.2",
  icon: "icon.png",
  language: "pt-BR",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  badges: [{ label: "Manutenção", textColor: "#000000", backgroundColor: "#FACC15" }],
  developers: [
    {
      name: "matheusparnaiba",
      github: "https://github.com/matheusparnaiba",
    },
  ],
} satisfies ExtensionInfo;
