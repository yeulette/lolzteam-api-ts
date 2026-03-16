/**
 * src/core/mixin.ts
 * -----------------
 * Base class injected into all auto-generated API classes.
 * Provides the _request() helper that bridges generated methods → HTTP client.
 */
import { LolzteamClient, RequestOptions } from "./client";

export class ApiMixin {
  /** Injected by the parent Forum/Market client. */
  _client!: LolzteamClient;

  protected _request(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    return this._client.request(method, path, options);
  }
}
