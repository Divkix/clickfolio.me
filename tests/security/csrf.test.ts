import { describe, expect, it } from "vite-plus/test";
import { needsOriginCheck } from "@/app/start";

function check(method: string, pathname: string, handlerType: "serverFn" | "router" = "router") {
  return needsOriginCheck({
    handlerType,
    pathname,
    request: new Request(`https://clickfolio.me${pathname}`, { method }),
  });
}

describe("needsOriginCheck", () => {
  it.each([
    ["PUT", "/api/profile/handle"],
    ["PUT", "/api/profile/privacy"],
    ["POST", "/api/account/delete"],
    ["POST", "/api/resume/claim"],
    ["POST", "/api/upload"],
    ["DELETE", "/api/admin/resumes/abc"],
    ["DELETE", "/api/upload/pending"],
  ])("checks %s %s", (method, path) => {
    expect(check(method, path)).toBe(true);
  });

  it("skips the Svix-signed Clerk webhook", () => {
    expect(check("POST", "/api/webhooks/clerk")).toBe(false);
  });

  it.each([
    ["GET", "/@someone"],
    ["HEAD", "/"],
    ["GET", "/api/handle/check"],
    ["GET", "/api/cron/cleanup"],
  ])("lets %s %s through for links from other sites", (method, path) => {
    expect(check(method, path)).toBe(false);
  });

  it("checks every server function, GET included", () => {
    expect(check("GET", "/_serverFn/abc", "serverFn")).toBe(true);
  });
});
