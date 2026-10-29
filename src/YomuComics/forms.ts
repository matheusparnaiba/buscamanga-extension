/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { NSFW_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, type YomuSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "yomumangas.com",
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
  private type: string;
  private status: string;
  private nsfw: string;

  constructor(searchQuery: SearchQuery<YomuSearchMetadata>) {
    super();
    this.type = searchQuery.metadata?.type ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
    this.nsfw = searchQuery.metadata?.nsfw ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("type", {
          title: "Tipo de Obra",
          value: [this.type],
          options: TYPE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleTypeChange",
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
        SelectRow("nsfw", {
          title: "Conteúdo Adulto",
          value: [this.nsfw],
          options: NSFW_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleNsfwChange",
          ),
        }),
      ]),
    ];
  }

  async handleTypeChange(value: string[]): Promise<void> {
    this.type = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  async handleNsfwChange(value: string[]): Promise<void> {
    this.nsfw = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): YomuSearchMetadata {
    return {
      type: this.type,
      status: this.status,
      nsfw: this.nsfw,
    };
  }
}
