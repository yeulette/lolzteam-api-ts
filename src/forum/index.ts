/**
 * src/forum/index.ts
 * High-level Forum client for https://prod-api.lolz.live
 */
import { BaseClient, BaseClientOptions } from "../core/base";
import { ForumAPI } from "./_generated";

const FORUM_BASE_URL = "https://prod-api.lolz.live";

class ForumBase extends BaseClient {
  private _api: ForumAPI;

  constructor(options: BaseClientOptions) {
    super(FORUM_BASE_URL, { delayMs: 500, ...options });
    this._api = new ForumAPI();
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
    const proto = ForumAPI.prototype;
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

  /** Get a user by id. Alias for Users_Get. */
  usersGet(params: { user_id: number; fieldsInclude?: string[] }): Promise<Response> {
    return this._api.Users_Get({ userId: params.user_id, fieldsInclude: params.fieldsInclude });
  }

  /** List threads. Alias for Threads_List. */
  threadsList(params: Record<string, unknown> = {}): Promise<Response> {
    return this._http.request("GET", "/threads", { params });
  }

  /** Create a post. Alias for Posts_Create. */
  postsCreate(params: Record<string, unknown>): Promise<Response> {
    return this._http.request("POST", "/posts", { json: params });
  }
}

// Forum = BaseClient + all ForumAPI methods, fully typed
export type Forum = ForumBase & ForumAPI;
export const Forum = ForumBase as new (options: BaseClientOptions) => Forum;

export type { ForumAPI };
