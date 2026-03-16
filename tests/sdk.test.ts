/**
 * tests/sdk.test.ts
 * Unit tests for the lolzteam TypeScript SDK.
 * Uses _setFetch / _resetFetch to intercept all HTTP calls.
 */

import { Forum, Market } from "../src/index";
import { LolzteamClient, _setFetch, _resetFetch } from "../src/core/client";

const TOKEN = "token";
const FORUM_BASE = "https://prod-api.lolz.live";
const MARKET_BASE = "https://api.lzt.market";

// ── Mock helpers ────────────────────────────────────────────────────────────

function mockResp(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

afterEach(() => {
  _resetFetch();
});

// ── LolzteamClient ──────────────────────────────────────────────────────────

describe("LolzteamClient", () => {
  test("sends Bearer token header", async () => {
    let capturedReq: Request | undefined;
    _setFetch(async (input, init) => {
      capturedReq = new Request(input as RequestInfo, init);
      return mockResp({ ok: true });
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    await client.request("GET", "/users/me");

    expect(capturedReq?.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  test("sends Accept-Language header", async () => {
    let capturedReq: Request | undefined;
    _setFetch(async (input, init) => {
      capturedReq = new Request(input as RequestInfo, init);
      return mockResp({});
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN, language: "ru" });
    await client.request("GET", "/users/me");

    expect(capturedReq?.headers.get("Accept-Language")).toBe("ru");
  });

  test("retries on 429 and succeeds on 3rd attempt", async () => {
    let callCount = 0;
    _setFetch(async () => {
      callCount++;
      if (callCount < 3) return mockResp({ error: "rate limit" }, 429, { "Retry-After": "0.001" });
      return mockResp({ ok: true });
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    const resp = await client.request("GET", "/users/me");

    expect(resp.status).toBe(200);
    expect(callCount).toBe(3);
  });

  test("retries on 503", async () => {
    let callCount = 0;
    _setFetch(async () => {
      callCount++;
      if (callCount < 2) return mockResp({ error: "unavailable" }, 503);
      return mockResp({ ok: true });
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    const resp = await client.request("GET", "/ping");

    expect(resp.status).toBe(200);
    expect(callCount).toBe(2);
  });

  test("token setter updates header on next request", async () => {
    let capturedAuth = "";
    _setFetch(async (input, init) => {
      capturedAuth = new Request(input as RequestInfo, init).headers.get("Authorization") ?? "";
      return mockResp({});
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    client.token = "new_token_xyz";
    await client.request("GET", "/users/me");

    expect(capturedAuth).toBe("Bearer new_token_xyz");
  });

  test("appends query params to URL", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({});
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    await client.request("GET", "/threads", { params: { forum_id: 876, limit: 10 } });

    expect(capturedUrl).toContain("forum_id=876");
    expect(capturedUrl).toContain("limit=10");
  });

  test("sends JSON body", async () => {
    let capturedBody = "";
    _setFetch(async (input, init) => {
      capturedBody = (init?.body as string) ?? "";
      return mockResp({});
    });

    const client = new LolzteamClient({ baseUrl: FORUM_BASE, token: TOKEN });
    await client.request("POST", "/posts", { json: { thread_id: 1, post_body: "Hello" } });

    const parsed = JSON.parse(capturedBody);
    expect(parsed.thread_id).toBe(1);
    expect(parsed.post_body).toBe("Hello");
  });
});

// ── Forum ───────────────────────────────────────────────────────────────────


describe("Forum", () => {
  test("usersGet calls correct endpoint", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({ user: { user_id: 42 } });
    });

    const forum = new Forum({ token: TOKEN });
    const resp = await forum.usersGet({ user_id: 42 });
    const data = await resp.json();

    expect(capturedUrl).toContain("/users/42");
    expect(data.user.user_id).toBe(42);
  });

  test("threadsList calls /threads with params", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({ threads: [] });
    });

    const forum = new Forum({ token: TOKEN });
    await forum.threadsList({ forum_id: 876 });

    expect(capturedUrl).toContain("/threads");
    expect(capturedUrl).toContain("forum_id=876");
  });

  test("token setter propagates to requests", async () => {
    let capturedAuth = "";
    _setFetch(async (input, init) => {
      capturedAuth = new Request(input as RequestInfo, init).headers.get("Authorization") ?? "";
      return mockResp({});
    });

    const forum = new Forum({ token: TOKEN });
    forum.token = "updated_token";
    await forum.threadsList();

    expect(capturedAuth).toBe("Bearer updated_token");
  });

  test("language setter propagates to requests", async () => {
    let capturedLang = "";
    _setFetch(async (input, init) => {
      capturedLang = new Request(input as RequestInfo, init).headers.get("Accept-Language") ?? "";
      return mockResp({});
    });

    const forum = new Forum({ token: TOKEN, language: "ru" });
    await forum.threadsList();

    expect(capturedLang).toBe("ru");
  });

  test("raw request() works on Forum", async () => {
    _setFetch(async () => mockResp({ raw: true }));

    const forum = new Forum({ token: TOKEN });
    const resp = await forum.request("GET", "/users/me");
    const data = await resp.json();

    expect(data.raw).toBe(true);
  });

  test("postsCreate sends JSON body", async () => {
    let capturedBody = "";
    _setFetch(async (input, init) => {
      capturedBody = (init?.body as string) ?? "";
      return mockResp({ post: {} });
    });

    const forum = new Forum({ token: TOKEN });
    await forum.postsCreate({ thread_id: 123, post_body: "Hello world" });

    const body = JSON.parse(capturedBody);
    expect(body.thread_id).toBe(123);
    expect(body.post_body).toBe("Hello world");
  });
});

// ── Market ──────────────────────────────────────────────────────────────────


describe("Market", () => {
  test("getMe calls /me", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({ user: { user_id: 7 } });
    });

    const market = new Market({ token: TOKEN });
    const resp = await market.getMe();
    const data = await resp.json();

    expect(capturedUrl).toContain("/me");
    expect(data.user.user_id).toBe(7);
  });

  test("getItem calls correct item endpoint", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({ item: { item_id: 12345678 } });
    });

    const market = new Market({ token: TOKEN });
    await market.getItem({ item_id: 12345678 });

    expect(capturedUrl).toContain("/12345678");
  });

  test("getPayments passes query params", async () => {
    let capturedUrl = "";
    _setFetch(async (input) => {
      capturedUrl = (input as string).toString();
      return mockResp({ payments: [] });
    });

    const market = new Market({ token: TOKEN });
    await market.getPayments({ page: 2, limit: 50 });

    expect(capturedUrl).toContain("page=2");
    expect(capturedUrl).toContain("limit=50");
  });

  test("transfer sends correct body", async () => {
    let capturedBody = "";
    _setFetch(async (input, init) => {
      capturedBody = (init?.body as string) ?? "";
      return mockResp({ success: true });
    });

    const market = new Market({ token: TOKEN });
    await market.transfer({ receiver: "username", currency: "rub", amount: 100, comment: "thanks" });

    const body = JSON.parse(capturedBody);
    expect(body.receiver).toBe("username");
    expect(body.amount).toBe(100);
  });

  test("token setter propagates to Market requests", async () => {
    let capturedAuth = "";
    _setFetch(async (input, init) => {
      capturedAuth = new Request(input as RequestInfo, init).headers.get("Authorization") ?? "";
      return mockResp({});
    });

    const market = new Market({ token: TOKEN });
    market.token = "market_new_token";
    await market.getMe();

    expect(capturedAuth).toBe("Bearer market_new_token");
  });
});
