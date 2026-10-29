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
  FORMAT_OPTIONS,
  ORDER_OPTIONS,
  STATUS_OPTIONS,
  type VegitoonsSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "vegitoons.black",
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
  private format: string;
  private status: string;

  constructor(searchQuery: SearchQuery<VegitoonsSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "ultima_atualizacao";
    this.format = searchQuery.metadata?.format ?? "";
    this.status = searchQuery.metadata?.status ?? "";
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
        SelectRow("format", {
          title: "Formato",
          value: [this.format],
          options: FORMAT_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleFormatChange",
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

  async handleOrderChange(value: string[]): Promise<void> {
    this.order = value[0] ?? "ultima_atualizacao";
  }

  async handleFormatChange(value: string[]): Promise<void> {
    this.format = value[0] ?? "";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "";
  }

  override getSearchQueryMetadata(): VegitoonsSearchMetadata {
    return {
      order: this.order,
      format: this.format,
      status: this.status,
    };
  }
}
