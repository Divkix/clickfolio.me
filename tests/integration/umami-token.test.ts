import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getUmamiToken } from "@/lib/umami/client";

// SAFETY: getUmamiToken reads only UMAMI_API_URL, UMAMI_USERNAME, and UMAMI_PASSWORD from env.
const env = {
  UMAMI_API_URL: "https://umami.test",
  UMAMI_USERNAME: "user",
  UMAMI_PASSWORD: "pass",
} as CloudflareEnv;

describe("getUmamiToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one login across concurrent cold callers", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "token-1" }), { status: 200 }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const tokens = await Promise.all([getUmamiToken(env), getUmamiToken(env), getUmamiToken(env)]);

    expect(tokens).toEqual(["token-1", "token-1", "token-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
