/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { SORT_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, type RoxinhaSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "roxinha.online",
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
  private status: string;
  private type: string;

  constructor(searchQuery: SearchQuery<RoxinhaSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? "views";
    this.status = searchQuery.metadata?.status ?? "";
    this.type = searchQuery.metadata?.type ?? "";
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
        SelectRow("type", {
          title: "Tipo",
          value: [this.type],
          options: TYPE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleTypeChange",
          ),
        }),
      ]),
    ];
  }

  async handleSortChange(value: string[]): Promise<void> {
    this.sort = value[0] ?? "views";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "";
  }

  async handleTypeChange(value: string[]): Promise<void> {
    this.type = value[0] ?? "";
  }

  override getSearchQueryMetadata(): RoxinhaSearchMetadata {
    return {
      sort: this.sort,
      status: this.status,
      type: this.type,
      order: this.sort === "title" ? "ASC" : "DESC",
    };
  }
}
