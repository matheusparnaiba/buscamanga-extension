import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Kami Sama Explorer",
  description:
    "Extensão da Kami Sama Explorer dedicada às obras de Akira Toriyama, Dragon Ball e clássicos shonen.",
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
