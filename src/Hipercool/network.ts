/* SPDX-License-Identifier: GPL-3.0-or-later */
import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    const isImage =
      /\.(jpg|jpeg|png|webp|gif|ico|avif)((\?|#).*)?$/i.test(request.url) ||
      request.url.includes("/uploads/") ||
      request.url.includes("img.");

    const headers: Record<string, string> = {
      ...request.headers,
      "x-flux-node": "G2ZsDdWhUwdU82Vw",
      referer: "https://lerhentais.com/",
      "user-agent": await Application.getDefaultUserAgent(),
      accept:
        request.headers?.["accept"] ??
        (isImage
          ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          : "application/json, text/plain, */*"),
    };

    if (request.method && request.method.toUpperCase() !== "GET") {
      headers["origin"] = "https://lerhentais.com";
    }

    const savedCookie = Application.getState("hipercool_st_cookie") as string | undefined;
    if (savedCookie) {
      headers["cookie"] = savedCookie;
    }

    request.headers = headers;
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    void request;
    const rawHeaders = response.headers;
    if (rawHeaders) {
      const setCookie =
        rawHeaders["set-cookie"] ?? rawHeaders["Set-Cookie"] ?? rawHeaders["set-Cookie"];
      if (setCookie && typeof setCookie === "string") {
        const match = setCookie.match(/(__st=[^;]+)/);
        if (match?.[1]) {
          Application.setState(match[1], "hipercool_st_cookie");
        }
      }
    }
    return data;
  }
}
