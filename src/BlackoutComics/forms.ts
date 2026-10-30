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

import { GENRE_OPTIONS, STATUS_OPTIONS, type BlackoutComicsSearchMetadata } from "./models";

export class SettingsForm extends Form {
  private customCookie: string;

  constructor() {
    super();
    this.customCookie =
      (Application.getState("blackout_cookie_header") as string | undefined) ?? "";
  }

  override getSections() {
    const hasSession =
      this.customCookie.length > 0 || Boolean(Application.getState("blackout_saved_cookies"));

    return [
      Section("auth", [
        WebViewRow("login_webview", {
          title: "Entrar na sua Conta (Webview)",
          request: {
            url: "https://blackoutcomics.com/comics",
            method: "GET",
          },
          onComplete: Application.Selector(this as SettingsForm, "handleLoginComplete"),
          onCancel: Application.Selector(this as SettingsForm, "handleLoginCancel"),
        }),
        InputRow("custom_cookie", {
          title: "Cookie de Sessão (blackout-comics-session)",
          value: this.customCookie,
          onValueChange: Application.Selector(this as SettingsForm, "handleCookieChange"),
        }),
        LabelRow("auth_status", {
          title: "Status de Autenticação",
          value: hasSession
            ? { text: "Autenticado", style: "success" }
            : { text: "Não Autenticado (Necessário p/ ler)", style: "warning" },
        }),
      ]),
      Section("info", [
        LabelRow("source_info", {
          title: "Fonte Oficial",
          value: "blackoutcomics.com",
        }),
        LabelRow("category_info", {
          title: "Categoria",
          value: "Pornhwas, Webtoons & Adulto (+18)",
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

  async handleLoginComplete(cookies: Cookie[]): Promise<void> {
    if (Array.isArray(cookies) && cookies.length > 0) {
      const saved = cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      }));
      Application.setState(saved, "blackout_saved_cookies");
    }
  }

  async handleLoginCancel(): Promise<void> {
    // No-op
  }

  async handleCookieChange(value: string): Promise<void> {
    this.customCookie = value.trim();
    if (this.customCookie) {
      Application.setState(this.customCookie, "blackout_cookie_header");
    } else {
      Application.setState(undefined, "blackout_cookie_header");
    }
  }
}

export class ContentTemplateAdvancedSearchForm extends AdvancedSearchForm {
  private genre: string;
  private status: string;

  constructor(searchQuery: SearchQuery<BlackoutComicsSearchMetadata>) {
    super();
    this.genre = searchQuery.metadata?.genre ?? "all";
    this.status = searchQuery.metadata?.status ?? "all";
  }

  override getSections() {
    return [
      Section("filters", [
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
          title: "Filtrar por Status",
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

  async handleGenreChange(value: string[]): Promise<void> {
    this.genre = value[0] ?? "all";
  }

  async handleStatusChange(value: string[]): Promise<void> {
    this.status = value[0] ?? "all";
  }

  override getSearchQueryMetadata(): BlackoutComicsSearchMetadata {
    return {
      genre: this.genre,
      status: this.status,
    };
  }
}
