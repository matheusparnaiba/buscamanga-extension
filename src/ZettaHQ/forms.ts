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

import { CATEGORY_OPTIONS, type ZettaHQSearchMetadata } from "./models";

export class SettingsForm extends Form {
  private customCookie: string;

  constructor() {
    super();
    this.customCookie = (Application.getState("zetta_cookie_header") as string | undefined) ?? "";
  }

  override getSections() {
    const hasSession =
      this.customCookie.length > 0 || Boolean(Application.getState("zetta_saved_cookies"));

    return [
      Section("cloudflare", [
        WebViewRow("cf_webview", {
          title: "Resolver Cloudflare (Webview)",
          request: {
            url: "https://zettahq.com/",
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
          value: "zettahq.com",
        }),
        LabelRow("category_info", {
          title: "Categoria",
          value: "HQ Hentai, Comic & 3D (+18)",
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
      Application.setState(saved, "zetta_saved_cookies");
    }
  }

  async handleWebviewCancel(): Promise<void> {
    // No-op
  }

  async handleCookieChange(value: string): Promise<void> {
    this.customCookie = value.trim();
    if (this.customCookie) {
      Application.setState(this.customCookie, "zetta_cookie_header");
    } else {
      Application.setState(undefined, "zetta_cookie_header");
    }
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private category: string;

  constructor(searchQuery: SearchQuery<ZettaHQSearchMetadata>) {
    super();
    this.category = searchQuery.metadata?.category ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
        SelectRow("category", {
          title: "Filtrar por Categoria",
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

  override getSearchQueryMetadata(): ZettaHQSearchMetadata {
    return {
      category: this.category,
    };
  }
}
