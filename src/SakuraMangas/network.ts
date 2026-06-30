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
    request.headers = {
      ...request.headers,
      referer: "https://sakuramangas.org/",
      "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
    };
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
        throw new CloudflareError(request, "Cloudflare detected, bypass it to continue!");
      }
    }

    return data;
  }
}
