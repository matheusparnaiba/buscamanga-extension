/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

// Intercepts all the requests and responses and allows you to make changes to them
export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...(request.headers ?? {}),
      ...{
        referer: "https://sakuramangas.org/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      },
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (response.status === 403 || response.status === 503) {
      throw new Error(
        `Cloudflare protection detected (${response.status}). Por favor, abra o site da fonte no WebView do Paperback clicando no ícone do globo no canto superior direito para resolver o captcha e aguarde carregar, depois tente novamente.`,
      );
    }

    return data;
  }
}
