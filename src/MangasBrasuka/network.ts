/* SPDX-License-Identifier: GPL-3.0-or-later */

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
      referer: "https://mangasbrasuka.com.br/",
      "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://mangasbrasuka.com.br";
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
        throw new CloudflareError(
          { url: "https://mangasbrasuka.com.br/", method: "GET" },
          "Proteção Cloudflare ativa no Mangás Brasuka! Toque para resolver.",
        );
      }
    }

    return data;
  }
}
