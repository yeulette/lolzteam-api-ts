/**
 * src/market/index.ts
 * High-level Market client for https://api.lzt.market
 */
import { BaseClient, BaseClientOptions } from "../core/base";
import { MarketAPI } from "./_generated";

const MARKET_BASE_URL = "https://api.lzt.market";

class MarketBase extends BaseClient {
  private _api: MarketAPI;

  constructor(options: BaseClientOptions) {
    super(MARKET_BASE_URL, { delayMs: 500, ...options });
    this._api = new MarketAPI();
    this._api._client = this._http;
    this._mixinApi();
  }

  override set token(value: string) {
    super.token = value;
    if (this._api) this._api._client = this._http;
  }
  override get token(): string {
    return super.token;
  }

  private _mixinApi(): void {
    const proto = MarketAPI.prototype;
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === "constructor" || key.startsWith("_")) continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor && typeof descriptor.value === "function") {
        (this as unknown as Record<string, unknown>)[key] = (
          ...args: unknown[]
        ) => (this._api as unknown as Record<string, (...a: unknown[]) => unknown>)[key](...args);
      }
    }
  }

  // ── Convenience aliases (camelCase + snake_case params) ─────────────────

  /** Get current user profile. Alias for Profile_Get. */
  getMe(params: { fieldsInclude?: string[] } = {}): Promise<Response> {
    return this._api.Profile_Get(params);
  }

  /** Get an item by id. Alias for Managing_Get. */
  getItem(params: { item_id: number; parseSameItemIds?: boolean }): Promise<Response> {
    return this._api.Managing_Get({ itemId: params.item_id, parseSameItemIds: params.parseSameItemIds });
  }

  /** Get payments history. Alias for Payments_History. */
  getPayments(params: { page?: number; limit?: number; [key: string]: unknown } = {}): Promise<Response> {
    return this._api.Payments_History(params as Parameters<MarketAPI["Payments_History"]>[0]);
  }

  /** Transfer money. Alias for Payments_Transfer. */
  transfer(params: Record<string, unknown>): Promise<Response> {
    return this._http.request("POST", "/balance/transfer", { json: params });
  }
}

// Market = BaseClient + all MarketAPI methods, fully typed
export type Market = MarketBase & MarketAPI;
export const Market = MarketBase as new (options: BaseClientOptions) => Market;

export type { MarketAPI };
