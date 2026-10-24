import { describe, expect, it } from "vite-plus/test";
import {
  encodedProfileRedirect,
  isPublicProfilePath,
  withoutProfileCredentials,
} from "@/lib/worker/shared-cache-request";

/** Strip as the worker does, from the request's own pathname. */
function strip(request: Request): Request {
  return withoutProfileCredentials(request, new URL(request.url).pathname);
}

const signedIn = { cookie: "__session=jwt; __client_uat=1", authorization: "Bearer jwt" };

describe("encodedProfileRedirect", () => {
  it("sends /%40handle to /@handle, keeping the query", () => {
    const response = encodedProfileRedirect(new URL("https://clickfolio.me/%40alice.md?x=1"));

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://clickfolio.me/@alice.md?x=1");
  });

  it("leaves /@handle alone", () => {
    expect(encodedProfileRedirect(new URL("https://clickfolio.me/@alice"))).toBeNull();
  });
});

describe("withoutProfileCredentials", () => {
  it.each(["/@alice", "/%40alice", "/@alice.md", "/@alice?_rsc=1"])(
    "drops the session from GET %s",
    (path) => {
      const stripped = strip(
        new Request(`https://clickfolio.me${path}`, {
          headers: { ...signedIn, accept: "text/html" },
        }),
      );

      expect(stripped.headers.get("cookie")).toBeNull();
      expect(stripped.headers.get("authorization")).toBeNull();
      expect(stripped.headers.get("accept")).toBe("text/html");
      expect(stripped.url).toBe(`https://clickfolio.me${path}`);
    },
  );

  it("drops the session from HEAD requests too", () => {
    const stripped = strip(
      new Request("https://clickfolio.me/@alice", { method: "HEAD", headers: signedIn }),
    );

    expect(stripped.headers.get("cookie")).toBeNull();
  });

  it.each(["/dashboard", "/api/site-data", "/themes", "/ws/resume-status", "/alice"])(
    "keeps the session on %s",
    (path) => {
      const request = new Request(`https://clickfolio.me${path}`, { headers: signedIn });

      expect(strip(request)).toBe(request);
    },
  );

  it("keeps the session on non-GET requests to profile paths", () => {
    const request = new Request("https://clickfolio.me/@alice", {
      method: "POST",
      headers: signedIn,
    });

    expect(strip(request)).toBe(request);
  });

  it("matches only paths that start with a handle", () => {
    expect(isPublicProfilePath("/@alice")).toBe(true);
    expect(isPublicProfilePath("/blog/@alice")).toBe(false);
  });
});
