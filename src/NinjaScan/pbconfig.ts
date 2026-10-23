import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Ninja Scan",
  description:
    "Extensão oficial da Ninja Scan com traduções de manhwas e manhuas de combate e fantasia.",
  version: "1.0.3",
  icon: "icon.png",
  language: "pt-br",
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
