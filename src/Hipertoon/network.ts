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

    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/uploads/") ||
      request.url.includes("img.");

    const headers: Record<string, string> = {
      ...request.headers,
      referer: "https://hipertoon.com/",
      "user-agent": ua,
      accept:
        request.headers?.["accept"] ??
        request.headers?.["Accept"] ??
        (isImage
          ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          : "application/json, text/plain, */*"),
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://hipertoon.com";
    }

    const cookieHeader = Application.getState("hipertoon_cookie_header") as string | undefined;
    if (cookieHeader) {
      headers["cookie"] = cookieHeader;
      headers["Cookie"] = cookieHeader;
    }

    const savedCookies = Application.getState("hipertoon_saved_cookies") as
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
    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/uploads/") ||
      request.url.includes("img.");

    if (!isImage) {
      const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
      const resolutionRequest: Request = {
        url: "https://hipertoon.com/",
        method: "GET",
        headers: {
          "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
          referer: "https://hipertoon.com/",
        },
      };

      if (response.status === 403 || response.status === 503) {
        throw new CloudflareError(
          resolutionRequest,
          "Cloudflare detectado no Hipertoon, resolva o desafio para continuar!",
        );
      }

      const text = Application.arrayBufferToUTF8String(data);
      if (
        text.includes("Just a moment...") ||
        text.includes("_cf_chl_opt") ||
        text.includes("challenges.cloudflare.com")
      ) {
        throw new CloudflareError(
          resolutionRequest,
          "Cloudflare detectado no Hipertoon, resolva o desafio para continuar!",
        );
      }
    }

    return data;
  }
}
