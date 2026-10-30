import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "Hipercool",
  description:
    'Extensão adulta oficial da LerHentais / Hipercool ("https://lerhentais.com") com acervo de mangás e quadrinhos adultos.',
  version: "1.0.1",
  icon: "icon.png",
  language: "pt-BR",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [{ label: "+18", textColor: "#ffffff", backgroundColor: "#dc3545" }],
  developers: [
    {
      name: "matheusparnaiba",
      github: "https://github.com/matheusparnaiba",
    },
  ],
} satisfies ExtensionInfo;
