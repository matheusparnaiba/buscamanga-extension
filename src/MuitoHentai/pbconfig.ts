import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Muito Hentai",
  description: 'Extensão do "https://www.muitohentai.com" (conteúdo adulto +18)',
  version: "1.0.6",
  icon: "icon.png",
  language: "pt-br",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [{ label: "18+", textColor: "#FFFFFF", backgroundColor: "#DC2626" }],
  developers: [
    {
      name: "matheusparnaiba",
      github: "https://github.com/matheusparnaiba",
    },
  ],
} satisfies ExtensionInfo;
