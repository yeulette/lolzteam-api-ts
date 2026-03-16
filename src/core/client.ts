/**
 * src/core/client.ts
 * ------------------
 * Universal HTTP transport layer.
 * Works in Node.js (via cross-fetch / native fetch in Node 18+)
 * and in the Browser (native fetch).
 */

// ── Fetch shim ─────────────────────────────────────────────────────────────
// Exported so tests can swap it out without touching globalThis.
export let _activeFetch: typeof fetch = (...args) => {
  const f =
    typeof globalThis.fetch === "function"
      ? globalThis.fetch
      : // eslint-disable-next-line @typescript-eslint/no-var-requires
        (require("cross-fetch") as { fetch: typeof fetch }).fetch;
  return f(...args);
};

/** Override the fetch implementation (tests only). */
export function _setFetch(fn: typeof fetch): void {
  _activeFetch = fn;
}
/** Restore to the real fetch. */
export function _resetFetch(): void {
  _activeFetch = (...args) => {
    const f =
      typeof globalThis.fetch === "function"
        ? globalThis.fetch
        : (require("cross-fetch") as { fetch: typeof fetch }).fetch;
    return f(...args);
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClientOptions {
  /** API base URL, e.g. "https://prod-api.lolz.live" */
  baseUrl: string;
  /** Bearer auth token */
  token: string;
  /** Response language: "ru" | "en" */
  language?: string;
  /** Proxy URL string (Node.js only). e.g. "socks5://user:pass@host:1080" */
  proxy?: string;
  /** Request timeout in milliseconds (default: 30 000) */
  timeoutMs?: number;
  /** Minimum delay between consecutive requests in milliseconds */
  delayMs?: number;
}

export interface RequestOptions {
  params?: Record<string, unknown>;
  json?: Record<string, unknown>;
  data?: Record<string, unknown>;
  signal?: AbortSignal;
}

// ── Constants ──────────────────────────────────────────────────────────────

const RETRY_STATUSES = new Set([429, 502, 503]);
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

// ── Helpers ────────────────────────────────────────────────────────────────

function jitter(attempt: number): number {
  return Math.random() * BASE_BACKOFF_MS * Math.pow(2, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(token: string, language: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Accept-Language": language,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "lolzteam-ts-sdk/1.0.0",
  };
}

function buildUrl(base: string, path: string, params?: Record<string, unknown>): string {
  const url = new URL(path.startsWith("http") ? path : base.replace(/\/$/, "") + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

async function buildProxyAgent(proxy: string): Promise<unknown> {
  try {
    if (proxy.startsWith("socks")) {
      const { SocksProxyAgent } = await import("socks-proxy-agent" as string);
      return new (SocksProxyAgent as new (url: string) => unknown)(proxy);
    } else {
      const { HttpsProxyAgent } = await import("https-proxy-agent" as string);
      return new (HttpsProxyAgent as new (url: string) => unknown)(proxy);
    }
  } catch {
    console.warn(
      "[lolzteam] Proxy support requires 'socks-proxy-agent' or 'https-proxy-agent'.\n" +
        "Install with: npm install socks-proxy-agent https-proxy-agent"
    );
    return undefined;
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class LolzteamClient {
  private _baseUrl: string;
  private _token: string;
  private _language: string;
  private _proxy: string | undefined;
  private _timeoutMs: number;
  private _delayMs: number | undefined;
  private _lastRequestAt = 0;
  private _proxyAgent: unknown = undefined;

  constructor(options: ClientOptions) {
    this._baseUrl = options.baseUrl.replace(/\/$/, "");
    this._token = options.token;
    this._language = options.language ?? "en";
    this._proxy = options.proxy;
    this._timeoutMs = options.timeoutMs ?? 30_000;
    this._delayMs = options.delayMs;

    if (options.proxy) {
      buildProxyAgent(options.proxy).then((agent) => {
        this._proxyAgent = agent;
      });
    }
  }

  // ── Getters / setters ───────────────────────────────────────────────────

  get token(): string { return this._token; }
  set token(value: string) { this._token = value; }

  get language(): string { return this._language; }
  set language(value: string) { this._language = value; }

  get proxy(): string | undefined { return this._proxy; }
  set proxy(value: string | undefined) {
    this._proxy = value;
    if (value) {
      buildProxyAgent(value).then((agent) => { this._proxyAgent = agent; });
    } else {
      this._proxyAgent = undefined;
    }
  }

  // ── Core request ────────────────────────────────────────────────────────

  async request(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    await this._throttle();

    const url = buildUrl(this._baseUrl, path, options.params);
    const headers = buildHeaders(this._token, this._language);

    let body: string | URLSearchParams | undefined;

    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers["Content-Type"] = "application/json";
    } else if (options.data !== undefined) {
      const filtered = Object.fromEntries(
        Object.entries(options.data)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      );
      body = new URLSearchParams(filtered).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this._timeoutMs);

      const signal = options.signal
        ? this._combineSignals(options.signal, controller.signal)
        : controller.signal;

      try {
        const fetchOptions: RequestInit & { agent?: unknown } = {
          method,
          headers,
          body,
          signal,
          ...(this._proxyAgent ? { agent: this._proxyAgent } : {}),
        };

        lastResponse = await _activeFetch(url, fetchOptions);
      } finally {
        clearTimeout(timer);
      }

      if (!RETRY_STATUSES.has(lastResponse!.status)) {
        return lastResponse!;
      }

      const retryAfter = lastResponse!.headers.get("Retry-After");
      const wait = retryAfter ? parseFloat(retryAfter) * 1000 : jitter(attempt);
      console.warn(
        `[lolzteam] ${lastResponse!.status} – retrying in ${Math.round(wait)}ms (attempt ${attempt + 1})`
      );
      await sleep(wait);
    }

    return lastResponse!;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async _throttle(): Promise<void> {
    if (!this._delayMs) return;
    const elapsed = Date.now() - this._lastRequestAt;
    if (elapsed < this._delayMs) {
      await sleep(this._delayMs - elapsed);
    }
    this._lastRequestAt = Date.now();
  }

  private _combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();
    a.addEventListener("abort", abort, { once: true });
    b.addEventListener("abort", abort, { once: true });
    return controller.signal;
  }
}
