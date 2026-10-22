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
    const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());

    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/cover/") ||
      request.url.includes("/manga/") ||
      request.url.includes("/manhwa/") ||
      request.url.includes("img.") ||
      request.url.includes("snipercache");

    const targetDomain = request.url.startsWith("https://mangasbrasuka.org")
      ? "https://mangasbrasuka.org"
      : "https://mangasbrasuka.com.br";

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer ?? `${targetDomain}/`,
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
      headers["origin"] = request.headers?.origin ?? targetDomain;
    }

    delete headers["Cookie"];
    const cookieHeader = Application.getState("brasuka_cookie_header") as string | undefined;
    if (cookieHeader) {
      headers["cookie"] = cookieHeader;
    }

    const savedCookies = Application.getState("brasuka_saved_cookies") as
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
      request.url.includes("/cover/") ||
      request.url.includes("/manga/") ||
      request.url.includes("/manhwa/") ||
      request.url.includes("img.") ||
      request.url.includes("snipercache");

    if (!isImage) {
      const text = Application.arrayBufferToUTF8String(data);
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
        const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
        const targetDomain = request.url.startsWith("https://mangasbrasuka.org")
          ? "https://mangasbrasuka.org"
          : "https://mangasbrasuka.com.br";

        const resolutionRequest: Request = {
          url: `${targetDomain}/`,
          method: "GET",
          headers: {
            "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
            referer: `${targetDomain}/`,
          },
        };

        throw new CloudflareError(
          resolutionRequest,
          "Proteção Cloudflare ativa no Mangás Brasuka! Toque para resolver.",
        );
      }
    }

    return data;
  }
}
