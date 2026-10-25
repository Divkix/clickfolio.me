import { describe, expect, it } from "vite-plus/test";
import {
  CACHE_TAG,
  EDGE_CACHE_CONTROL,
  edgeCacheHeaders,
  edgeResponse,
} from "@/lib/cache/edge-cache";

function page(status: number, headers: Record<string, string> = {}): Response {
  return new Response("<html></html>", { status, headers });
}

const optedIn = edgeCacheHeaders(300, ["edge-0123456789abcdef0123456789abcdef"]);

describe("edgeResponse", () => {
  it("shares an opted-in render of an anonymous request with its tags", () => {
    const response = edgeResponse(page(200, optedIn), true);

    expect(response.headers.get(EDGE_CACHE_CONTROL)).toContain("max-age=300");
    expect(response.headers.get(CACHE_TAG)).toBe("edge-0123456789abcdef0123456789abcdef");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
  });

  it("never stores a signed-in render, even of an opted-in page", () => {
    const response = edgeResponse(page(200, optedIn), false);

    expect(response.headers.get(EDGE_CACHE_CONTROL)).toBe("no-store");
    expect(response.headers.has(CACHE_TAG)).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
  });

  it("never stores a failed render", () => {
    const response = edgeResponse(page(503, optedIn), true);

    expect(response.headers.get(EDGE_CACHE_CONTROL)).toBe("no-store");
    expect(response.headers.has(CACHE_TAG)).toBe(false);
  });

  it("tells browsers not to store a page that set no policy", () => {
    const response = edgeResponse(page(200), true);

    expect(response.headers.get(EDGE_CACHE_CONTROL)).toBe("no-store");
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, max-age=0, must-revalidate",
    );
  });

  it("keeps a policy the page set itself", () => {
    const response = edgeResponse(page(200, { "Cache-Control": "public, max-age=60" }), true);

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
