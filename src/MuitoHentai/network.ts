import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

// Intercepta todas as requisições e respostas da extensão
export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    if (request.url.startsWith("http://")) {
      request.url = request.url.replace(/^http:\/\//i, "https://");
    }

    request.headers = {
      ...request.headers,
      referer: "https://www.muitohentai.com/",
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
