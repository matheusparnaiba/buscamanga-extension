/* SPDX-License-Identifier: GPL-3.0-or-later */
import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: "https://blackoutcomics.com/",
      cookie:
        'age_gate_consent={"consentAt":1790812800000,"expiresAt":2145916800000}; _popprepop=1',
      "user-agent": await Application.getDefaultUserAgent(),
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
