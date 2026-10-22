/* SPDX-License-Identifier: GPL-3.0-or-later */
import { AdvancedSearchForm, Form, Section, SelectRow, type SearchQuery } from "@paperback/types";

import { MODE_OPTIONS, type ContentTemplateSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [];
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private mode: "include" | "exclude";

  constructor(searchQuery: SearchQuery<ContentTemplateSearchMetadata>) {
    super();
    this.mode = searchQuery.metadata?.mode ?? "include";
  }

  override getSections() {
    return [
      Section("filter", [
        SelectRow("mode", {
          title: "Search Filter",
          value: [this.mode],
          options: MODE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as ContentTemplateAdvancedSearchForm,
            "handleModeChange",
          ),
        }),
      ]),
    ];
  }

  async handleModeChange(value: string[]): Promise<void> {
    this.mode = value[0] === "exclude" ? "exclude" : "include";
  }

  override getSearchQueryMetadata(): ContentTemplateSearchMetadata {
    return { mode: this.mode };
  }
}
