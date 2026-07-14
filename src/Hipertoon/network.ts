/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

// Intercepts all the requests and responses and allows you to make changes to them
export class MainInterceptor extends PaperbackInterceptor {
  private homepageFetched = false;

  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: "https://hipertoon.com/",
      origin: "https://hipertoon.com",
      "user-agent": await Application.getDefaultUserAgent(),
    };

    if (request.url.includes("/api/trpc/") && !this.homepageFetched) {
      this.homepageFetched = true;
      try {
        await Application.scheduleRequest({
          url: "https://hipertoon.com/",
          method: "GET",
        });
      } catch (e) {
        this.homepageFetched = false;
      }
    }

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
