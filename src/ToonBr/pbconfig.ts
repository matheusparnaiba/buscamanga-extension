import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "ToonBr",
  description: "Extensão oficial do ToonBr com ampla biblioteca de webtoons e manhwas traduzidos.",
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
