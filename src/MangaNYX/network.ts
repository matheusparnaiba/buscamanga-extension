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
    const headers: Record<string, string> = {
      ...request.headers,
      referer: "https://manganyx.com/",
      "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://manganyx.com";
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
        request.url.includes("img.");
      if (!isImage) {
        throw new CloudflareError(request, "Cloudflare detected, bypass it to continue!");
      }
    }

    return data;
  }
}
