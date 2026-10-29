/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import { ORDER_OPTIONS, VARIANT_OPTIONS, type BRScansSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "brscans.com",
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
  private variant: string;

  constructor(searchQuery: SearchQuery<BRScansSearchMetadata>) {
    super();
    this.order = searchQuery.metadata?.order ?? "latest";
    this.variant = searchQuery.metadata?.variant ?? "translated";
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
        SelectRow("variant", {
          title: "Variante Padrão",
          value: [this.variant],
          options: VARIANT_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleVariantChange",
          ),
        }),
      ]),
    ];
  }

  async handleOrderChange(value: string[]): Promise<void> {
    this.order = value[0] ?? "latest";
  }

  async handleVariantChange(value: string[]): Promise<void> {
    this.variant = value[0] ?? "translated";
  }

  override getSearchQueryMetadata(): BRScansSearchMetadata {
    return {
      order: this.order,
      variant: this.variant,
    };
  }
}
