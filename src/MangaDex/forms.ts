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
  RATING_FILTER_OPTIONS,
  STATUS_OPTIONS,
  type MangaDexSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "mangadex.org (API v5)",
        }),
        LabelRow("lang_info", {
          title: "Filtro de Idioma",
          value: "Português (PT-BR)",
        }),
        LabelRow("status_info", {
          title: "Status da API",
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
  private orderBy: "latestUploadedChapter" | "followedCount" | "rating" | "title";
  private status: string;
  private ratingFilter: string;

  constructor(searchQuery: SearchQuery<MangaDexSearchMetadata>) {
    super();
    this.orderBy = searchQuery.metadata?.orderBy ?? "latestUploadedChapter";
    this.status = searchQuery.metadata?.status ?? "all";
    this.ratingFilter = searchQuery.metadata?.ratingFilter ?? "safe_suggestive";
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
        SelectRow("ratingFilter", {
          title: "Classificação de Conteúdo",
          value: [this.ratingFilter],
          options: RATING_FILTER_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleRatingChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    if (
      val === "latestUploadedChapter" ||
      val === "followedCount" ||
      val === "rating" ||
      val === "title"
    ) {
      this.orderBy = val;
    }
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  async handleRatingChange(value: string[]): Promise<void> {
    this.ratingFilter = value[0] ?? "safe_suggestive";
  }

  override getSearchQueryMetadata(): MangaDexSearchMetadata {
    return {
      orderBy: this.orderBy,
      status: this.status,
      ratingFilter: this.ratingFilter,
    };
  }
}
