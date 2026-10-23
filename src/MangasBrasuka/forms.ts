import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { MODE_OPTIONS, type ContentTemplateSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "mangasbrasuka.com.br",
        }),
        LabelRow("status_info", {
          title: "Status da Scan",
          value: { text: "Operacional", style: "success" },
        }),
        LabelRow("repo_info", {
          title: "BuscaMangá Extension",
          subtitle: "Repositório mantido pela comunidade brasileira",
          value: "v0.9/stable",
        }),
      ]),
    ];
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private mode: "include" | "exclude";

  constructor(searchQuery: SearchQuery<ContentTemplateSearchMetadata>) {
    super();
    this.mode = searchQuery.metadata?.mode ?? "include";
  }

  override getSections() {
    return [
      Section("filter", [
        SelectRow("mode", {
          title: "Search Filter Template",
          value: [this.mode],
          options: MODE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleModeChange",
          ),
        }),
      ]),
    ];
  }

  async handleModeChange(value: string[]): Promise<void> {
    this.mode = value[0] === "exclude" ? "exclude" : "include";
  }

  override getSearchQueryMetadata(): ContentTemplateSearchMetadata {
    return { mode: this.mode };
  }
}
