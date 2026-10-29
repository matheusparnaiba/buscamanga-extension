/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import {
  CATEGORY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  type MangaDashSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "mangadash.net",
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
  private sort: string;
  private category: string;
  private status: string;

  constructor(searchQuery: SearchQuery<MangaDashSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? "recentes";
    this.category = searchQuery.metadata?.category ?? "";
    this.status = searchQuery.metadata?.status ?? "";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("sort", {
          title: "Ordenar Por",
          value: [this.sort],
          options: SORT_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleSortChange",
          ),
        }),
        SelectRow("category", {
          title: "Categoria",
          value: [this.category],
          options: CATEGORY_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleCategoryChange",
          ),
        }),
        SelectRow("status", {
          title: "Status",
          value: [this.status],
          options: STATUS_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleStatusChange",
          ),
        }),
      ]),
    ];
  }

  async handleSortChange(value: string[]): Promise<void> {
    this.sort = value[0] ?? "recentes";
  }

  async handleCategoryChange(value: string[]): Promise<void> {
    this.category = value[0] ?? "";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "";
  }

  override getSearchQueryMetadata(): MangaDashSearchMetadata {
    return {
      sort: this.sort,
      category: this.category,
      status: this.status,
    };
  }
}
