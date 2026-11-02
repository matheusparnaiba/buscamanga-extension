/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { CATEGORY_OPTIONS, type HentaiDaTiaSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "hentaidatia.com",
        }),
        LabelRow("category_info", {
          title: "Categoria",
          value: "Mangás Hentai, Doujins & Galerias (+18)",
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
  private category: string;

  constructor(searchQuery: SearchQuery<HentaiDaTiaSearchMetadata>) {
    super();
    this.category = searchQuery.metadata?.category ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("category", {
          title: "Filtrar por Categoria ou Paródia",
          value: [this.category],
          options: CATEGORY_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleCategoryChange",
          ),
        }),
      ]),
    ];
  }

  async handleCategoryChange(value: string[]): Promise<void> {
    this.category = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): HentaiDaTiaSearchMetadata {
    return {
      category: this.category,
    };
  }
}
