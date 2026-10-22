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
    const headers: Record<string, string> = {
      ...request.headers,
      referer: "https://hipertoon.com/",
      "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://hipertoon.com";
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
      if (response.status === 403 || response.status === 503) {
        throw new CloudflareError(
          { url: "https://hipertoon.com/", method: "GET" },
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
          { url: "https://hipertoon.com/", method: "GET" },
          "Cloudflare detectado no Hipertoon, resolva o desafio para continuar!",
        );
      }
    }

    return data;
  }
}
