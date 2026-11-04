/* SPDX-License-Identifier: GPL-3.0-or-later */
import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

const BASE_URL = "https://superecchi.com";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: request.headers?.referer || `${BASE_URL}/`,
      origin: request.headers?.origin || BASE_URL,
      "user-agent": request.headers?.["user-agent"] || (await Application.getDefaultUserAgent()),
      accept: request.headers?.accept || "*/*",
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
    void request;
    void response;
    return data;
  }
}
