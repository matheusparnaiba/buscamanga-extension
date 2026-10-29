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
  DEMOGRAPHIC_OPTIONS,
  GENRE_OPTIONS,
  ORDER_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  type NexusMangasSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "nexusmangas.com",
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
  private order: "avg_rating.desc.nullslast" | "updated_at.desc" | "created_at.desc" | "title.asc";
  private type: string;
  private status: string;
  private demographic: string;
  private genre: string;

  constructor(searchQuery: SearchQuery<NexusMangasSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "updated_at.desc";
    this.type = searchQuery.metadata?.type ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
    this.demographic = searchQuery.metadata?.demographic ?? "all";
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
        SelectRow("demographic", {
          title: "Demografia",
          value: [this.demographic],
          options: DEMOGRAPHIC_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleDemographicChange",
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
      val === "avg_rating.desc.nullslast" ||
      val === "updated_at.desc" ||
      val === "created_at.desc" ||
      val === "title.asc"
    ) {
      this.order = val;
    }
  }

  async handleTypeChange(value: string[]): Promise<void> {
    this.type = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  async handleDemographicChange(value: string[]): Promise<void> {
    this.demographic = value[0] ?? "all";
  }

  async handleGenreChange(value: string[]): Promise<void> {
    this.genre = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): NexusMangasSearchMetadata {
    return {
      order: this.order,
      type: this.type,
      status: this.status,
      demographic: this.demographic,
      genre: this.genre,
    };
  }
}
