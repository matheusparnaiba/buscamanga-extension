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
  GENRE_OPTIONS,
  ORDER_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  type CapitoonsSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "capitoons.com",
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
  private order: "popular" | "update" | "latest" | "title" | "titlereverse";
  private status: string;
  private type: string;
  private genre: string;

  constructor(searchQuery: SearchQuery<CapitoonsSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "popular";
    this.status = searchQuery.metadata?.status ?? "all";
    this.type = searchQuery.metadata?.type ?? "all";
    this.genre = searchQuery.metadata?.genre ?? "all";
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
        SelectRow("genre", {
          title: "Gênero",
          value: [this.genre],
          options: GENRE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleGenreChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    if (
      val === "popular" ||
      val === "update" ||
      val === "latest" ||
      val === "title" ||
      val === "titlereverse"
    ) {
      this.order = val;
    }
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  async handleTypeChange(value: string[]): Promise<void> {
    this.type = value[0] ?? "all";
  }

  async handleGenreChange(value: string[]): Promise<void> {
    this.genre = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): CapitoonsSearchMetadata {
    return {
      order: this.order,
      status: this.status,
      type: this.type,
      genre: this.genre,
    };
  }
}
