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
  ORDER_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  type OneReaderSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "onereader.net",
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
  private order: string;
  private status: string;
  private type: string;

  constructor(searchQuery: SearchQuery<OneReaderSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "az";
    this.status = searchQuery.metadata?.status ?? "";
    this.type = searchQuery.metadata?.type ?? "";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("order", {
          title: "Ordenar Por",
          value: [this.order],
          options: ORDER_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleOrderChange",
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

  async handleOrderChange(value: string[]): Promise<void> {
    this.order = value[0] ?? "az";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "";
  }

  async handleTypeChange(value: string[]): Promise<void> {
    this.type = value[0] ?? "";
  }

  override getSearchQueryMetadata(): OneReaderSearchMetadata {
    return {
      order: this.order,
      status: this.status,
      type: this.type,
    };
  }
}
