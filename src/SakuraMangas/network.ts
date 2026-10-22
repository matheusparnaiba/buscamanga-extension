/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import {
  PaperbackInterceptor,
  type Request,
  type Response,
  CloudflareError,
} from "@paperback/types";

// Intercepts all the requests and responses and allows you to make changes to them
export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());

    const headers: Record<string, string> = {
      ...request.headers,
      referer: "https://sakuramangas.org/",
      "user-agent": ua,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://sakuramangas.org";
    }

    const cookieHeader = Application.getState("sakura_cookie_header") as string | undefined;
    if (cookieHeader) {
      headers["cookie"] = cookieHeader;
      headers["Cookie"] = cookieHeader;
    }

    const savedCookies = Application.getState("sakura_saved_cookies") as
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
        request.url.includes("/uploads/") ||
        request.url.includes("img.");
      if (!isImage) {
        const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
        throw new CloudflareError(
          {
            url: "https://sakuramangas.org/",
            method: "GET",
            headers: {
              "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
              referer: "https://sakuramangas.org/",
            },
          },
          "Cloudflare detectado no Sakura Mangas, realize o bypass para continuar!",
        );
      }
    }

    return data;
  }
}
