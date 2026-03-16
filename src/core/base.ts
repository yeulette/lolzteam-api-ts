/**
 * src/core/base.ts
 * ----------------
 * BaseClient – shared logic for Forum and Market clients.
 * Handles token/language/proxy changes at runtime.
 */
import { LolzteamClient, ClientOptions, RequestOptions } from "./client";

export interface BaseClientOptions {
  /** Bearer auth token */
  token: string;
  /** Response language: "ru" | "en" (default: "en") */
  language?: string;
  /**
   * Proxy URL (Node.js only).
   * e.g. "socks5://user:pass@host:1080" or "http://host:8080"
   */
  proxy?: string;
  /** Request timeout in milliseconds (default: 30 000) */
  timeoutMs?: number;
  /** Minimum delay between requests in milliseconds */
  delayMs?: number;
}

export abstract class BaseClient {
  protected _http: LolzteamClient;

  constructor(baseUrl: string, options: BaseClientOptions) {
    this._http = new LolzteamClient({
      baseUrl,
      token: options.token,
      language: options.language ?? "en",
      proxy: options.proxy,
      timeoutMs: options.timeoutMs ?? 30_000,
      delayMs: options.delayMs,
    });
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  /** Change the bearer token at runtime. */
  set token(value: string) {
    this._http.token = value;
  }
  get token(): string {
    return this._http.token;
  }

  /** Change the response language at runtime. */
  set language(value: string) {
    this._http.language = value;
  }
  get language(): string {
    return this._http.language;
  }

  /** Change or remove the proxy at runtime. */
  set proxy(value: string | undefined) {
    this._http.proxy = value;
  }
  get proxy(): string | undefined {
    return this._http.proxy;
  }

  // ── Raw request passthrough ───────────────────────────────────────────────

  /**
   * Send a raw request.
   *
   * @example
   * const resp = await client.request("GET", "/users/me");
   * const data = await resp.json();
   */
  request(method: string, path: string, options?: RequestOptions): Promise<Response> {
    return this._http.request(method, path, options);
  }
}
