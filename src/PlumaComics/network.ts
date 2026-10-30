/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

const BASE_URL = "https://plumacomics.cloud";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: request.headers?.referer || `${BASE_URL}/`,
      "user-agent": request.headers?.["user-agent"] || (await Application.getDefaultUserAgent()),
      "accept-language":
        request.headers?.["accept-language"] || "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/api/cover/") ||
      request.url.includes("/api/page/");

    if (!isImage && data) {
      const text = (Application.arrayBufferToUTF8String(data) as string | undefined) || "";
      const cfMitigated = response.headers?.["cf-mitigated"] || response.headers?.["Cf-Mitigated"];
      const isCf =
        cfMitigated === "challenge" ||
        text.includes("Just a moment...") ||
        text.includes("_cf_chl_opt") ||
        text.includes("challenges.cloudflare.com") ||
        text.includes("challenge-platform") ||
        ((response.status === 403 || response.status === 503) &&
          text.trim().startsWith("<") &&
          text.toLowerCase().includes("cloudflare"));

      if (isCf) {
        throw new CloudflareError(
          {
            url: `${BASE_URL}/`,
            method: "GET",
            headers: {
              "user-agent": await Application.getDefaultUserAgent(),
              referer: `${BASE_URL}/`,
            },
          },
          "Proteção Cloudflare ativa na Pluma Comics! Toque para resolver.",
        );
      }

      if (response.status === 503 && text.includes("manutenção")) {
        throw new CloudflareError(
          {
            url: `${BASE_URL}/`,
            method: "GET",
          },
          "Pluma Comics em manutenção (acesso temporariamente limitado a membros VIP)! Toque para abrir.",
        );
      }
    }

    return data;
  }
}
