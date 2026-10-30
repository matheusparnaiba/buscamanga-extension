import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "BR Scans",
  description:
    "Extensão oficial da BR Scans com foco em manhwas e webtoons com múltiplas variantes de leitura.",
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
