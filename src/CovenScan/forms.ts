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

import {
  GENRE_OPTIONS,
  ORDER_OPTIONS,
  STATUS_OPTIONS,
  type ContentTemplateSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  private customCookie: string;

  constructor() {
    super();
    this.customCookie = (Application.getState("coven_cookie_header") as string | undefined) ?? "";
  }

  override getSections() {
    const hasSession =
      this.customCookie.length > 0 || Boolean(Application.getState("coven_saved_cookies"));

    return [
      Section("cloudflare", [
        WebViewRow("cf_webview", {
          title: "Resolver Cloudflare (Webview)",
          request: {
            url: "https://covendasbruxonas.com/manga/?m_orderby=latest",
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
          value: "covendasbruxonas.com",
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
      Application.setState(saved, "coven_saved_cookies");
    }
  }

  async handleWebviewCancel(): Promise<void> {
    // No-op
  }

  async handleCookieChange(value: string): Promise<void> {
    this.customCookie = value.trim();
    if (this.customCookie) {
      Application.setState(this.customCookie, "coven_cookie_header");
    } else {
      Application.setState(undefined, "coven_cookie_header");
    }
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private orderBy: "views" | "latest" | "alphabet" | "rating";
  private genre: string;
  private status: string;

  constructor(searchQuery: SearchQuery<ContentTemplateSearchMetadata>) {
    super();
    this.orderBy = searchQuery.metadata?.orderBy ?? "views";
    this.genre = searchQuery.metadata?.genre ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
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

  async handleOrderChange(value: string[]): Promise<void> {
    const val = value[0];
    if (val === "views" || val === "latest" || val === "alphabet" || val === "rating") {
      this.orderBy = val;
    }
  }

  async handleGenreChange(value: string[]): Promise<void> {
    this.genre = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): ContentTemplateSearchMetadata {
    return { orderBy: this.orderBy, genre: this.genre, status: this.status };
  }
}
