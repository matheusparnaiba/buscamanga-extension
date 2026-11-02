/* SPDX-License-Identifier: GPL-3.0-or-later */
import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

import { decryptKuroPayload } from "./crypto";

const BASE_URL = "https://kuromangas.com";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const cfUserAgent = Application.getState("kuro_cf_user_agent") as string | undefined;
    const customCookie = Application.getState("kuro_cookie_header") as string | undefined;
    const savedCtx = Application.getState("kuro_x_request_ctx") as string | undefined;

    const headers: Record<string, string> = {
      ...request.headers,
      origin: BASE_URL,
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

    if (!headers["x-request-ctx"] && !headers["X-Request-Ctx"]) {
      let ctx = savedCtx;
      if (!ctx && headers.cookie) {
        const vxMatch = headers.cookie.match(/(?:^|;\s*)_vx=([^;]+)/);
        if (vxMatch?.[1]) {
          ctx = decodeURIComponent(vxMatch[1]);
        }
      }
      if (ctx) {
        headers["X-Request-Ctx"] = ctx;
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

      if (text.includes('"_v_secure"')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object" && "_v_secure" in parsed) {
            const datakey = response.headers?.["x-kuro-datakey"] as string | undefined;
            const decrypted = decryptKuroPayload(parsed, datakey);
            const decryptedStr = JSON.stringify(decrypted);
            const encoded = new TextEncoder().encode(decryptedStr);
            return encoded.buffer as ArrayBuffer;
          }
        } catch (e) {
          console.error("Erro ao descriptografar resposta do Kuro Mangás:", e);
        }
      }
    }

    return data;
  }
}
