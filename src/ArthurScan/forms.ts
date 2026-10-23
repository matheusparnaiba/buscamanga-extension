/* SPDX-License-Identifier: GPL-3.0-or-later */
import { AdvancedSearchForm, Form, Section, SelectRow, type SearchQuery } from "@paperback/types";

import { ORDER_OPTIONS, type ContentTemplateSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [];
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private orderBy: "views" | "latest" | "alphabet" | "rating";

  constructor(searchQuery: SearchQuery<ContentTemplateSearchMetadata>) {
    super();
    this.orderBy = searchQuery.metadata?.orderBy ?? "views";
  }

  override getSections() {
    return [
      Section("filter", [
        SelectRow("orderBy", {
          title: "Ordenar Por",
          value: [this.orderBy],
          options: ORDER_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleOrderChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    this.orderBy = val === "latest" || val === "alphabet" || val === "rating" ? val : "views";
  }

  override getSearchQueryMetadata(): ContentTemplateSearchMetadata {
    return { orderBy: this.orderBy };
  }
}
