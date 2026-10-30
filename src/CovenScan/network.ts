/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

const BASE_URL = "https://covendasbruxonas.com";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("coven_cf_user_agent") as string | undefined;
    const customCookie = Application.getState("coven_cookie_header") as string | undefined;

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer || `${BASE_URL}/`,
      "user-agent":
        request.headers?.["user-agent"] || cfUserAgent || (await Application.getDefaultUserAgent()),
      accept:
        request.headers?.accept ||
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
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
      request.url.includes("/wp-content/uploads/");

    if (!isImage && data) {
      const text = (Application.arrayBufferToUTF8String(data) as string | undefined) || "";
      const cfMitigated = response.headers?.["cf-mitigated"] || response.headers?.["Cf-Mitigated"];
      const isCf =
        cfMitigated === "challenge" ||
        text.includes("Just a moment...") ||
        text.includes("_cf_chl_opt") ||
        text.includes("challenges.cloudflare.com") ||
        (response.status === 403 &&
          text.trim().startsWith("<") &&
          text.toLowerCase().includes("cloudflare"));

      if (isCf) {
        const cfUserAgent = Application.getState("coven_cf_user_agent") as string | undefined;
        const resolutionRequest: Request = {
          url: `${BASE_URL}/manga/?m_orderby=latest`,
          method: "GET",
          headers: {
            "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
            referer: `${BASE_URL}/`,
          },
        };

        throw new CloudflareError(
          resolutionRequest,
          "Proteção Cloudflare ativa no Coven Scan! Toque para resolver.",
        );
      }
    }

    return data;
  }
}
