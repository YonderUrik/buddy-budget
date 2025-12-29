import { NextRequest } from "next/server";

/**
 * Builder class for creating mock NextRequest objects in tests
 */
export class RequestBuilder {
  private url: URL;
  private method: string = "GET";
  private bodyData?: any;
  private headersData: Record<string, string> = {};

  constructor(path: string) {
    this.url = new URL(path, "http://localhost:3000");
  }

  /**
   * Add query parameters to the request
   */
  searchParams(params: Record<string, string>): this {
    Object.entries(params).forEach(([key, value]) => {
      this.url.searchParams.set(key, value);
    });
    return this;
  }

  /**
   * Set the request body
   */
  body(data: any): this {
    this.bodyData = data;
    return this;
  }

  /**
   * Add headers to the request
   */
  headers(headers: Record<string, string>): this {
    this.headersData = { ...this.headersData, ...headers };
    return this;
  }

  /**
   * Set the HTTP method
   */
  setMethod(method: string): this {
    this.method = method;
    return this;
  }

  /**
   * Build the NextRequest object
   */
  build(): NextRequest {
    const config: any = {
      method: this.method,
      headers: this.headersData,
    };

    if (this.bodyData) {
      config.body = JSON.stringify(this.bodyData);
      if (!this.headersData["Content-Type"]) {
        this.headersData["Content-Type"] = "application/json";
      }
    }

    return new NextRequest(this.url, config);
  }
}
