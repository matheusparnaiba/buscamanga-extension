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
  type ContentTemplateSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "egotoons.com",
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
  private orderBy: string;
  private format: string;
  private status: string;

  constructor(searchQuery: SearchQuery<ContentTemplateSearchMetadata>) {
    super();
    this.orderBy = searchQuery.metadata?.orderBy ?? "recentes";
    this.format = searchQuery.metadata?.format ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
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
          title: "Status da Obra",
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
    this.orderBy = value[0] ?? "recentes";
  }

  async handleFormatChange(value: string[]): Promise<void> {
    this.format = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): ContentTemplateSearchMetadata {
    return {
      orderBy: this.orderBy,
      format: this.format,
      status: this.status,
    };
  }
}
