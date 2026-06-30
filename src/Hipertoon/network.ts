/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

// Intercepts all the requests and responses and allows you to make changes to them
export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: "https://hipertoon.com/",
      origin: "https://hipertoon.com",
      "user-agent": await Application.getDefaultUserAgent(),
      "x-api-key": "e7e69d92016d5a6a8c7711aa13080f69de00d4c4e3d3557f5ac307c24a081397",
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
