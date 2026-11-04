/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  AdvancedSearchForm,
  Form,
  InputRow,
  LabelRow,
  Section,
  SelectRow,
  WebViewRow,
  type Cookie,
  type SearchQuery,
} from "@paperback/types";

import { NSFW_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, type YomuSearchMetadata } from "./models";

export class SettingsForm extends Form {
  private customCookie: string;

  constructor() {
    super();
    this.customCookie = (Application.getState("yomu_cookie_header") as string | undefined) ?? "";
  }

  override getSections() {
    const hasSession =
      this.customCookie.length > 0 || Boolean(Application.getState("yomu_saved_cookies"));

    return [
      Section("cloudflare", [
        WebViewRow("cf_webview", {
          title: "Resolver Cloudflare (Webview)",
          request: {
            url: "https://yomumangas.com/",
            method: "GET",
          },
          onComplete: Application.Selector(this as SettingsForm, "handleWebviewComplete"),
          onCancel: Application.Selector(this as SettingsForm, "handleWebviewCancel"),
        }),
        InputRow("custom_cookie", {
          title: "Cookie Customizado",
          value: this.customCookie,
          onValueChange: Application.Selector(this as SettingsForm, "handleCookieChange"),
        }),
        LabelRow("cf_status", {
          title: "Status de Conexão",
          value: hasSession
            ? { text: "Sessão / Cookies Salvos", style: "success" }
            : { text: "Padrão" },
        }),
      ]),
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

  async handleWebviewComplete(cookies: Cookie[]): Promise<void> {
    if (Array.isArray(cookies) && cookies.length > 0) {
      const saved = cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      }));
      Application.setState(saved, "yomu_saved_cookies");
      const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      Application.setState(header, "yomu_cookie_header");
    }
  }

  async handleWebviewCancel(): Promise<void> {
    // No-op
  }

  async handleCookieChange(value: string): Promise<void> {
    this.customCookie = value.trim();
    if (this.customCookie) {
      Application.setState(this.customCookie, "yomu_cookie_header");
    } else {
      Application.setState(undefined, "yomu_cookie_header");
    }
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
      type: this.type !== "all" ? this.type : undefined,
      status: this.status !== "all" ? this.status : undefined,
      nsfw: this.nsfw !== "all" ? this.nsfw : undefined,
    };
  }
}
