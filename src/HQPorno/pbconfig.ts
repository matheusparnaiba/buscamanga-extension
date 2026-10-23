import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "HQ Porno",
  description:
    'Extensão do "https://www.hqporno.net" (Quadrinhos eróticos, hentai e HQs em português, conteúdo adulto +18)',
  version: "1.0.4",
  icon: "icon.png",
  language: "pt-br",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
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
