import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Pizzaria Scan",
  description:
    "Extensão oficial da Pizzaria Scan com foco em comédia, ecchi, manhwas e mangás variados.",
  version: "1.0.1",
  icon: "icon.png",
  language: "pt-br",
  contentRating: ContentRating.MATURE,
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
