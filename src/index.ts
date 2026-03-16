/**
 * lolzteam
 * --------
 * TypeScript/JavaScript SDK for LOLZ Forum and ZT.Market APIs.
 *
 * Works in Node.js and Browser.
 *
 * @example
 * ```typescript
 * import { Forum, Market } from "lolzteam";
 *
 * const forum  = new Forum({ token: "YOUR_TOKEN" });
 * const market = new Market({ token: "YOUR_TOKEN" });
 *
 * const user = await (await forum.usersGet({ user_id: 2410024 })).json();
 * const item = await (await market.getItem({ item_id: 12345678 })).json();
 * ```
 */

export { Forum } from "./forum";
export { Market } from "./market";
export type { BaseClientOptions } from "./core/base";
export type { ClientOptions, RequestOptions } from "./core/client";
