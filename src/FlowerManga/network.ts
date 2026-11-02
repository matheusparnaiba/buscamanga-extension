/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

const BASE_URL = "https://flowermangas.net";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("flowermanga_cf_user_agent") as string | undefined;
    const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());

    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/wp-content/uploads/");

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer || `${BASE_URL}/`,
      "user-agent": request.headers?.["user-agent"] || ua,
      accept:
        request.headers?.accept ||
        (isImage
          ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"),
      "accept-language":
        request.headers?.["accept-language"] || "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    const cookieHeader = Application.getState("flowermanga_cookie_header") as string | undefined;
    if (cookieHeader && !headers["cookie"]) {
      headers["cookie"] = cookieHeader;
    }

    const savedCookies = Application.getState("flowermanga_saved_cookies") as
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
      request.url.includes("/wp-content/uploads/");

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
        const cfUserAgent = Application.getState("flowermanga_cf_user_agent") as string | undefined;
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
          "Proteção Cloudflare ativa no Flower Mangas! Toque para resolver.",
        );
      }
    }

    return data;
  }
}
