/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { ORDER_OPTIONS, type MangoToonsSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "mangotoons.com",
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

export class MangoToonsAdvancedSearchForm extends AdvancedSearchForm {
  private order: "populares" | "recentes";

  constructor(searchQuery: SearchQuery<MangoToonsSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "populares";
  }

  override getSections() {
    return [
      Section("filter_section", [
        SelectRow("order", {
          title: "Ordenar por",
          options: ORDER_OPTIONS,
          value: [this.order],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as MangoToonsAdvancedSearchForm,
            "handleOrderChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    if (val === "populares" || val === "recentes") {
      this.order = val;
    }
  }

  override getSearchQueryMetadata(): MangoToonsSearchMetadata {
    return { order: this.order };
  }
}
