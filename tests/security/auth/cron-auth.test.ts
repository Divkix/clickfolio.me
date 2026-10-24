import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { requireCronAuth } from "@/lib/auth/middleware";

vi.mock("@/lib/auth/clerk", () => ({
  requireAuthClerk: vi.fn(),
}));

// SAFETY: requireCronAuth reads nothing but CRON_SECRET, so a bare environment stands in.
const bareEnv = {} as CloudflareEnv;

const envWithSecret = Object.assign({}, bareEnv, { CRON_SECRET: "cron-secret-value" });

function cronRequest(authorization?: string): Request {
  const headers = new Headers();

  if (authorization !== undefined) headers.set("Authorization", authorization);

  return new Request("https://clickfolio.me/api/cron/cleanup", { method: "POST", headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireCronAuth", () => {
  it("accepts the exact bearer secret", () => {
    expect(requireCronAuth(cronRequest("Bearer cron-secret-value"), envWithSecret)).toBeNull();
  });

  it.each([
    ["a missing header", undefined],
    ["a wrong secret of the same length", "Bearer cron-secret-valuf"],
    ["a longer secret", "Bearer cron-secret-value-and-more"],
    ["a shorter secret", "Bearer cron"],
    ["the secret without the Bearer scheme", "cron-secret-value"],
    ["an empty header", ""],
  ])("answers 401 for %s", (_label, header) => {
    expect(requireCronAuth(cronRequest(header), envWithSecret)?.status).toBe(401);
  });

  it("answers 500 and never authenticates when CRON_SECRET is not configured", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(requireCronAuth(cronRequest("Bearer "), bareEnv)?.status).toBe(500);
    expect(requireCronAuth(cronRequest("Bearer undefined"), bareEnv)?.status).toBe(500);
  });
});
