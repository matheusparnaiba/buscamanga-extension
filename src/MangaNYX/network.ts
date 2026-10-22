/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  PaperbackInterceptor,
  type Request,
  type Response,
  CloudflareError,
} from "@paperback/types";

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

    const cookieHeader = Application.getState("manganyx_cookie_header") as string | undefined;
    if (cookieHeader) {
      headers["cookie"] = cookieHeader;
      headers["Cookie"] = cookieHeader;
    }

    const savedCookies = Application.getState("manganyx_saved_cookies") as
      | Array<{ name: string; value: string }>
      | undefined;
    if (Array.isArray(savedCookies)) {
      const cookieMap: Record<string, string> = { ...request.cookies };
      for (const c of savedCookies) {
        if (c?.name && c?.value) {
          cookieMap[c.name] = c.value;
        }
      }
      request.cookies = cookieMap;
    }

    request.headers = headers;
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (response.status === 403 || response.status === 503) {
      const isImage =
        /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
        request.url.includes("/cover/") ||
        request.url.includes("/manga/") ||
        request.url.includes("/manhwa/") ||
        request.url.includes("img.") ||
        request.url.includes("snipercache");
      if (!isImage) {
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
    }

    return data;
  }
}
