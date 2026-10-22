/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  PaperbackInterceptor,
  URL,
  type Cookie,
  type Request,
  type Response,
  CloudflareError,
} from "@paperback/types";

const COOKIE_STATE_KEY = "cookie_store_cookies";

export type SafeCookieStorageOptions = {
  storage: "stateManager" | "memory";
};

/**
 * Implementação segura do CookieStorageInterceptor que previne crashes de deserialização
 * de data (TypeError: cookie.expires.getTime is not a function) ao carregar do stateManager,
 * além de garantir a persistência adequada de cookies do Cloudflare (cf_clearance).
 */
export class SafeCookieStorageInterceptor extends PaperbackInterceptor {
  readonly options: SafeCookieStorageOptions;
  private _cookies: Record<string, Cookie> = {};

  get cookies(): Readonly<Cookie[]> {
    return Object.freeze(Object.values(this._cookies));
  }

  set cookies(newValue: Cookie[]) {
    const cookies: Record<string, Cookie> = {};
    for (const cookie of newValue) {
      if (this.isCookieExpired(cookie)) {
        continue;
      }
      cookies[this.cookieIdentifier(cookie)] = cookie;
    }
    this._cookies = cookies;
    this.saveCookiesToStorage();
  }

  constructor(options: SafeCookieStorageOptions = { storage: "stateManager" }) {
    super("cookie_store");
    this.options = options;
    this.loadCookiesFromStorage();
  }

  override async interceptRequest(request: Request): Promise<Request> {
    request.cookies = {
      ...request.cookies,
      ...this.cookiesForUrl(request.url).reduce<Record<string, string>>((v, c) => {
        v[c.name] = c.value;
        return v;
      }, {}),
    };
    return request;
  }

  override async interceptResponse(
    _request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const cookies = this._cookies;
    for (const cookie of response.cookies ?? []) {
      const identifier = this.cookieIdentifier(cookie);
      if (this.isCookieExpired(cookie)) {
        delete cookies[identifier];
        continue;
      }
      cookies[identifier] = cookie;
    }
    this._cookies = cookies;
    this.saveCookiesToStorage();
    return data;
  }

  setCookie(cookie: Cookie): void {
    if (!cookie || !cookie.name) return;

    const cleanCookie: Cookie = {
      ...cookie,
      expires: cookie.expires
        ? cookie.expires instanceof Date
          ? cookie.expires
          : new Date(cookie.expires)
        : /^_{0,2}cf/i.test(cookie.name)
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : undefined,
    };

    if (this.isCookieExpired(cleanCookie)) {
      return;
    }

    this._cookies[this.cookieIdentifier(cleanCookie)] = cleanCookie;
    this.saveCookiesToStorage();
  }

  deleteCookie(cookie: Cookie): void {
    delete this._cookies[this.cookieIdentifier(cookie)];
    this.saveCookiesToStorage();
  }

  cookiesForUrl(urlString: string): Cookie[] {
    const url = new URL(urlString);
    const hostname = url.hostname;
    if (!hostname) {
      return [];
    }

    const matchedCookies: Record<string, { cookie: Cookie; pathMatches: number }> = {};
    const pathname = url.path.startsWith("/") ? url.path : `/${url.path}`;
    const splitHostname = hostname.split(".");
    const splitUrlPath = pathname.split("/");
    splitUrlPath.shift();

    for (const cookie of this.cookies) {
      if (this.isCookieExpired(cookie)) {
        delete this._cookies[this.cookieIdentifier(cookie)];
        continue;
      }

      const cookieDomain = this.cookieSanitizedDomain(cookie);
      const splitCookieDomain = cookieDomain.split(".");
      if (splitHostname.length < splitCookieDomain.length || splitCookieDomain.length === 0) {
        continue;
      }

      let cookieDomainMatches = true;
      for (let i = 0; i < splitCookieDomain.length; i++) {
        const splitCookieIndex = splitCookieDomain.length - 1 - i;
        const splitHostnameIndex = splitHostname.length - 1 - i;
        if (splitCookieDomain[splitCookieIndex] !== splitHostname[splitHostnameIndex]) {
          cookieDomainMatches = false;
          break;
        }
      }

      if (!cookieDomainMatches) {
        continue;
      }

      const cookiePath = this.cookieSanitizedPath(cookie);
      const splitCookiePath = cookiePath.split("/");
      splitCookiePath.shift();

      let pathMatches = 0;
      if (pathname === cookiePath) {
        pathMatches = Number.MAX_SAFE_INTEGER;
      } else if (splitCookiePath.length === 0 || cookiePath === "/") {
        pathMatches = 1;
      } else if (pathname.startsWith(cookiePath) && splitUrlPath.length >= splitCookiePath.length) {
        for (let i = 0; i < splitCookiePath.length; i++) {
          if (splitCookiePath[i] === splitUrlPath[i]) {
            pathMatches += 1;
          } else {
            break;
          }
        }
      }

      if (pathMatches <= 0) {
        continue;
      }

      if ((matchedCookies[cookie.name]?.pathMatches ?? 0) < pathMatches) {
        matchedCookies[cookie.name] = { cookie, pathMatches };
      }
    }

    return Object.values(matchedCookies).map((x) => x.cookie);
  }

  private cookieIdentifier(cookie: Cookie): string {
    return `${cookie.name}-${this.cookieSanitizedDomain(cookie)}-${this.cookieSanitizedPath(cookie)}`;
  }

  private cookieSanitizedPath(cookie: Cookie): string {
    return cookie.path?.startsWith("/") ? cookie.path : "/" + (cookie.path ?? "");
  }

  private cookieSanitizedDomain(cookie: Cookie): string {
    return cookie.domain.replace(/^(www)?\.?/gi, "").toLowerCase();
  }

  private isCookieExpired(cookie: Cookie): boolean {
    if (!cookie.expires) {
      return false;
    }
    try {
      const exp =
        cookie.expires instanceof Date
          ? cookie.expires.getTime()
          : typeof cookie.expires === "string" || typeof cookie.expires === "number"
            ? new Date(cookie.expires).getTime()
            : 0;
      return exp > 0 && exp <= Date.now();
    } catch {
      return false;
    }
  }

  private loadCookiesFromStorage(): void {
    if (this.options.storage === "memory") return;
    try {
      const cookieData = Application.getState(COOKIE_STATE_KEY) as any[] | undefined;
      if (!cookieData || !Array.isArray(cookieData)) return;

      const cookies: Record<string, Cookie> = {};
      for (const item of cookieData) {
        if (!item || !item.name) continue;
        const cookie: Cookie = {
          ...item,
          expires: item.expires ? new Date(item.expires) : undefined,
        };
        if (!cookie.expires && /^_{0,2}cf/i.test(cookie.name)) {
          cookie.expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
        if (this.isCookieExpired(cookie)) continue;
        cookies[this.cookieIdentifier(cookie)] = cookie;
      }
      this._cookies = cookies;
    } catch {
      // Ignora falha de leitura do storage
    }
  }

  private saveCookiesToStorage(): void {
    if (this.options.storage === "memory") return;
    try {
      const valid = this.cookies.filter((c) => c && c.expires && !this.isCookieExpired(c));
      Application.setState(valid, COOKIE_STATE_KEY);
    } catch {
      // Ignora falha de escrita no storage
    }
  }
}

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());

    const fallbackReferer = request.url.startsWith("https://manganyx.org")
      ? "https://manganyx.org/"
      : "https://manganyx.com/";

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer ?? fallbackReferer,
      "user-agent": ua,
      accept:
        request.headers?.accept ??
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://manganyx.com";
    }

    return {
      ...request,
      headers,
    };
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const cfMitigated = response.headers?.["cf-mitigated"] || response.headers?.["Cf-Mitigated"];
    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/cover/") ||
      request.url.includes("/manga/") ||
      request.url.includes("/manhwa/") ||
      request.url.includes("img.") ||
      request.url.includes("snipercache");

    if (cfMitigated === "challenge" && !isImage) {
      const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
      const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());
      throw new CloudflareError(
        {
          url: "https://manganyx.com/",
          method: "GET",
          headers: {
            "user-agent": ua,
            referer: "https://manganyx.com/",
          },
        },
        "Proteção Cloudflare ativa no MangaNYX! Toque para resolver.",
      );
    }

    return data;
  }
}
