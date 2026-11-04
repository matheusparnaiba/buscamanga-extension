/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { CATEGORY_OPTIONS, ORDER_OPTIONS, type UniversoHentaiSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "universohentai.com",
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

export class UniversoHentaiAdvancedSearchForm extends AdvancedSearchForm {
  private order: "latest" | "popular";
  private category: string;

  constructor(searchQuery: SearchQuery<UniversoHentaiSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "latest";
    this.category = searchQuery.metadata?.category ?? "all";
  }

  override getSections() {
    return [
      Section("filter_section", [
        SelectRow("order", {
          title: "Ordenar por",
          options: ORDER_OPTIONS,
          value: [this.order],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as UniversoHentaiAdvancedSearchForm,
            "handleOrderChange",
          ),
        }),
        SelectRow("category", {
          title: "Categoria / Tag",
          options: CATEGORY_OPTIONS,
          value: [this.category],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as UniversoHentaiAdvancedSearchForm,
            "handleCategoryChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    if (val === "latest" || val === "popular") {
      this.order = val;
    }
  }

  async handleCategoryChange(value: string[]): Promise<void> {
    this.category = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): UniversoHentaiSearchMetadata {
    return { order: this.order, category: this.category };
  }
}
