/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { CATEGORY_OPTIONS, type ToonBrSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "toonbr.com",
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
  private categoryId: string;

  constructor(searchQuery: SearchQuery<ToonBrSearchMetadata>) {
    super();
    this.categoryId = searchQuery.metadata?.categoryId ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("categoryId", {
          title: "Categoria",
          value: [this.categoryId],
          options: CATEGORY_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleCategoryChange",
          ),
        }),
      ]),
    ];
  }

  async handleCategoryChange(value: string[]): Promise<void> {
    this.categoryId = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): ToonBrSearchMetadata {
    return {
      categoryId: this.categoryId,
    };
  }
}
