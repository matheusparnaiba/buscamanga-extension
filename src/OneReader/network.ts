/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

import { decryptORX3 } from "./decrypt";

const BASE_URL = "https://onereader.net";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("b2.onereader.net") ||
      request.url.includes("/m/") ||
      request.url.includes("#or_k=");

    const defaultUA = await Application.getDefaultUserAgent();
    const cfUserAgent = Application.getState("cf_user_agent") as string | undefined;
    const ua = cfUserAgent ?? defaultUA;

    const headers: Record<string, string> = {
      ...request.headers,
      referer: request.headers?.referer ?? `${BASE_URL}/`,
      "user-agent": ua,
      accept:
        request.headers?.["accept"] ??
        (isImage
          ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          : "application/json, text/plain, */*"),
    };

    const cookieHeader = Application.getState("onereader_cookie") as string | undefined;
    if (cookieHeader && !headers["cookie"] && !headers["Cookie"]) {
      headers["cookie"] = cookieHeader;
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
      request.url.includes("b2.onereader.net") ||
      request.url.includes("/m/") ||
      request.url.includes("#or_k=");

    if (!isImage && data) {
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
        const resolutionRequest: Request = {
          url: `${BASE_URL}/`,
          method: "GET",
          headers: {
            ...(cfUserAgent ? { "user-agent": cfUserAgent } : {}),
            referer: `${BASE_URL}/`,
          },
        };
        throw new CloudflareError(
          resolutionRequest,
          "Proteção Cloudflare ativa no OneReader! Toque para resolver.",
        );
      }
    }

    // Decodifica container protegido ORX3 se presente
    if (data && data.byteLength >= 20) {
      const envelope = new Uint8Array(data);
      if (
        envelope[0] === 0x4f && // O
        envelope[1] === 0x52 && // R
        envelope[2] === 0x58 && // X
        envelope[3] === 0x33 // 3
      ) {
        let key = "";
        if (request.url.includes("#or_k=")) {
          key = request.url.split("#or_k=")[1]?.split("&")[0] || "";
        }
        if (!key) {
          const rawUrl = request.url.split("#")[0] ?? request.url;
          key = (Application.getState(rawUrl) as string | undefined) || "";
        }

        if (key) {
          return decryptORX3(envelope, key);
        }
      }
    }

    return data;
  }
}
