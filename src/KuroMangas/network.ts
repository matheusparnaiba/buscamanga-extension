/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

const BASE_URL = "https://kuromangas.com";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("kuro_cf_user_agent") as string | undefined;
    const customCookie = Application.getState("kuro_cookie_header") as string | undefined;

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer || `${BASE_URL}/catalogo`,
      "user-agent":
        request.headers?.["user-agent"] || cfUserAgent || (await Application.getDefaultUserAgent()),
      accept: request.headers?.accept || "application/json, text/plain, */*",
      "accept-language":
        request.headers?.["accept-language"] || "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    if (customCookie && !headers.cookie) {
      headers.cookie = customCookie;
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
      request.url.includes("cdn.kuromangas.com");

    if (!isImage && data) {
      const text = (Application.arrayBufferToUTF8String(data) as string | undefined) || "";
      const isCf =
        text.includes("Just a moment...") ||
        text.includes("_cf_chl_opt") ||
        text.includes("challenges.cloudflare.com") ||
        (response.status === 403 &&
          text.trim().startsWith("<") &&
          text.toLowerCase().includes("cloudflare"));

      const isAuthRequired =
        response.status === 401 ||
        text.includes("Token de autenticação necessário") ||
        text.includes("Acesso negado");

      if (isCf || isAuthRequired) {
        const resolutionRequest: Request = {
          url: `${BASE_URL}/login`,
          method: "GET",
          headers: {
            "user-agent": await Application.getDefaultUserAgent(),
            referer: `${BASE_URL}/`,
          },
        };

        const msg = isAuthRequired
          ? "Login necessário no Kuro Mangás! Toque para autenticar no site."
          : "Proteção Cloudflare ativa no Kuro Mangás! Toque para resolver.";

        throw new CloudflareError(resolutionRequest, msg);
      }
    }

    return data;
  }
}
