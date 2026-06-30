/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  AdvancedSearchForm,
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
  type SearchQuery,
} from "@paperback/types";

import { MODE_OPTIONS, type ContentTemplateSearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("playground", [
        NavigationRow("playground", {
          title: "SourceUI Playground",
          form: new SourceUIPlaygroundForm(),
        }),
      ]),
    ];
  }
}

class SourceUIPlaygroundForm extends Form {
  private inputValue = "";
  private rowsVisible = false;
  private items: string[] = [];

  override getSections() {
    return [
      Section("textInput", [
        InputRow("input", {
          title: "Enter text",
          value: this.inputValue,
          onValueChange: Application.Selector(this as SourceUIPlaygroundForm, "handleInputChange"),
        }),
      ]),
      Section("interactiveRows", [
        ButtonRow("add", {
          title: "Add Row",
          onSelect: Application.Selector(this as SourceUIPlaygroundForm, "addNewItem"),
        }),
        ToggleRow("toggleVisible", {
          title: "Toggle Visibility",
          value: this.rowsVisible,
          onValueChange: Application.Selector(
            this as SourceUIPlaygroundForm,
            "handleRowsVisibleChange",
          ),
        }),
      ]),
      ...(this.rowsVisible
        ? [
            Section(
              "dynamicRows",
              this.items.map((item, index) => LabelRow(`item_${index}`, { title: item })),
            ),
          ]
        : []),
    ];
  }

  async handleRowsVisibleChange(value: boolean): Promise<void> {
    this.rowsVisible = value;
    this.reloadForm();
  }

  async handleInputChange(value: string): Promise<void> {
    this.inputValue = value;
    this.reloadForm();
  }

  async addNewItem(): Promise<void> {
    this.items.push("Item " + (this.items.length + 1));
    this.reloadForm();
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
          title: "Search Filter Template",
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
