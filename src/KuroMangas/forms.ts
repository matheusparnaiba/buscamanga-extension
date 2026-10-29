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
  type KuroMangasSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "kuromangas.com",
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
  private sort: "view_count" | "average_rating" | "created_at" | "title_asc" | "title_desc";
  private genre: string;
  private status: string;

  constructor(searchQuery: SearchQuery<KuroMangasSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? "view_count";
    this.genre = searchQuery.metadata?.genre ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("sort", {
          title: "Ordenar Por",
          value: [this.sort],
          options: ORDER_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleSortChange",
          ),
        }),
        SelectRow("genre", {
          title: "Filtrar por Gênero",
          value: [this.genre],
          options: GENRE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleGenreChange",
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

  async handleSortChange(value: string[]): Promise<void> {
    const val = value[0];
    if (
      val === "view_count" ||
      val === "average_rating" ||
      val === "created_at" ||
      val === "title_asc" ||
      val === "title_desc"
    ) {
      this.sort = val;
    }
  }

  async handleGenreChange(value: string[]): Promise<void> {
    this.genre = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): KuroMangasSearchMetadata {
    return { sort: this.sort, genre: this.genre, status: this.status };
  }
}
