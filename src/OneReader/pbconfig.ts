import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "OneReader",
  description:
    'Extensão oficial do OneReader ("https://onereader.net") com acervo de mangás, manhwas e manhuas.',
  version: "1.0.2",
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
