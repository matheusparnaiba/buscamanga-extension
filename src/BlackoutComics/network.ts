/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    const ua = cfUserAgent ?? (await Application.getDefaultUserAgent());

    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/projects/") ||
      request.url.includes("/banners/") ||
      request.url.includes("/media/") ||
      request.url.includes("img.");

    const defaultCookie =
      'age_gate_consent={"consentAt":1790812800000,"expiresAt":2145916800000}; _popprepop=1';

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer ?? "https://blackoutcomics.com/",
      "user-agent": ua,
      accept:
        request.headers?.["accept"] ??
        request.headers?.["Accept"] ??
        (isImage
          ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          : "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"),
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://blackoutcomics.com";
    }

    const customCookie = Application.getState("blackout_cookie_header") as string | undefined;
    if (customCookie) {
      if (!customCookie.includes("age_gate_consent")) {
        headers["cookie"] = `${defaultCookie}; ${customCookie}`;
      } else {
        headers["cookie"] = customCookie;
      }
    } else {
      const savedCookies = Application.getState("blackout_saved_cookies") as
        | Array<{ name: string; value: string }>
        | undefined;
      if (Array.isArray(savedCookies) && savedCookies.length > 0) {
        const parts = [defaultCookie];
        for (const c of savedCookies) {
          if (c?.name && c?.value) {
            parts.push(`${c.name}=${c.value}`);
          }
        }
        headers["cookie"] = parts.join("; ");
      } else {
        headers["cookie"] = defaultCookie;
      }
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
      request.url.includes("/projects/") ||
      request.url.includes("/banners/") ||
      request.url.includes("/media/");

    if (!isImage) {
      const text = Application.arrayBufferToUTF8String(data);
      const isCf =
        text.includes("Just a moment...") ||
        text.includes("_cf_chl_opt") ||
        text.includes("challenges.cloudflare.com") ||
        (response.status === 403 &&
          text.trim().startsWith("<") &&
          text.toLowerCase().includes("cloudflare"));

      if (isCf) {
        const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
        throw new CloudflareError(
          {
            url: "https://blackoutcomics.com/comics",
            method: "GET",
            headers: {
              "user-agent": cfUserAgent ?? (await Application.getDefaultUserAgent()),
              referer: "https://blackoutcomics.com/",
            },
          },
          "Proteção Cloudflare ativa no Blackout Comics! Toque para resolver.",
        );
      }
    }

    return data;
  }
}
