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
  type KuroMangasSearchMetadata,
} from "./models";

export class SettingsForm extends Form {
  private customCookie: string;

  constructor() {
    super();
    this.customCookie = (Application.getState("kuro_cookie_header") as string | undefined) ?? "";
  }

  override getSections() {
    const hasSession =
      this.customCookie.length > 0 || Boolean(Application.getState("kuro_saved_cookies"));

    return [
      Section("cloudflare", [
        WebViewRow("cf_webview", {
          title: "Autenticar / Resolver Cloudflare (Webview)",
          request: {
            url: "https://kuromangas.com/login",
            method: "GET",
          },
          onComplete: Application.Selector(this as SettingsForm, "handleWebviewComplete"),
          onCancel: Application.Selector(this as SettingsForm, "handleWebviewCancel"),
        }),
        InputRow("custom_cookie", {
          title: "Cookie Customizado / Sessão",
          value: this.customCookie,
          onValueChange: Application.Selector(this as SettingsForm, "handleCookieChange"),
        }),
        LabelRow("cf_status", {
          title: "Status de Autenticação",
          value: hasSession
            ? { text: "Sessão / Cookies Salvos", style: "success" }
            : { text: "Não Autenticado / Pendente", style: "warning" },
        }),
      ]),
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "kuromangas.com",
        }),
        LabelRow("status_info", {
          title: "Status da Scan",
          value: { text: "Requer Login / Turnstile", style: "warning" },
        }),
        LabelRow("repo_info", {
          title: "BuscaMangá Extension",
          subtitle: "Repositório mantido pela comunidade brasileira",
          value: "v0.9/stable",
        }),
      ]),
    ];
  }

  async handleWebviewComplete(_request?: any, cookies?: Cookie[]): Promise<void> {
    if (cookies && Array.isArray(cookies)) {
      const headerParts: string[] = [];
      let vx = "";
      for (const c of cookies) {
        if (!c || !c.name || !c.value) continue;
        headerParts.push(`${c.name}=${c.value}`);
        if (c.name === "_vx") {
          vx = c.value;
        }
      }
      if (headerParts.length > 0) {
        Application.setState(cookies, "kuro_saved_cookies");
        Application.setState(headerParts.join("; "), "kuro_cookie_header");
      }
      if (vx) {
        Application.setState(vx, "kuro_x_request_ctx");
      }
    }
  }

  async handleWebviewCancel(): Promise<void> {}

  async handleCookieChange(value: string): Promise<void> {
    const trimmed = (value ?? "").trim();
    Application.setState(trimmed, "kuro_cookie_header");
    const vxMatch = trimmed.match(/(?:^|;\s*)_vx=([^;]+)/);
    if (vxMatch?.[1]) {
      Application.setState(decodeURIComponent(vxMatch[1]), "kuro_x_request_ctx");
    }
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
    return {
      sort: this.sort,
      genre: this.genre,
      status: this.status,
    };
  }
}
