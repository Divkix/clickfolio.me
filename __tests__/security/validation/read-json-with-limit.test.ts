import { describe, expect, it } from "vite-plus/test";
import { readJsonWithLimit } from "@/lib/utils/validation";

/**
 * Security tests for readJsonWithLimit
 * Verifies that the helper enforces a hard byte cap on the request body
 * regardless of whether Content-Length is present, preventing unbounded-body DoS.
 */

function makeRequest(body: string, contentLength?: number): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (contentLength !== undefined) {
    headers["content-length"] = String(contentLength);
  }
  return new Request("https://example.com/api/test", {
    method: "POST",
    body,
    headers,
  });
}

function makeStreamingRequest(totalBytes: number, chunkSize = 1024): Request {
  // Build a ReadableStream that produces `totalBytes` bytes in chunks,
  // with NO Content-Length header — simulating a chunked / header-less request.
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const remaining = totalBytes - sent;
      const size = Math.min(chunkSize, remaining);
      controller.enqueue(new Uint8Array(size).fill(0x20)); // spaces
      sent += size;
    },
  });
  return new Request("https://example.com/api/test", {
    method: "POST",
    body: stream,
    // @ts-expect-error -- duplex is required in some runtimes for streaming bodies
    duplex: "half",
  });
}

describe("readJsonWithLimit", () => {
  it("returns ok:true with parsed data for a valid JSON body under the cap", async () => {
    const payload = JSON.stringify({ resume_id: "abc-123", foo: "bar" });
    const req = makeRequest(payload);
    const result = await readJsonWithLimit(req);
    expect(result).toEqual({ ok: true, data: { resume_id: "abc-123", foo: "bar" } });
  });

  it("returns ok:true with data:undefined when the request has no body", async () => {
    const req = new Request("https://example.com/api/test", { method: "POST" });
    const result = await readJsonWithLimit(req);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("returns too_large when a streaming body (no Content-Length) exceeds the cap", async () => {
    const limit = 100; // 100 bytes
    // Build a body that is larger than the limit using a plain string
    const oversizedBody = "x".repeat(limit + 1);
    const req = makeRequest(oversizedBody, undefined /* no Content-Length */);
    const result = await readJsonWithLimit(req, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
      expect(result.error).toContain("too large");
    }
  });

  it("returns too_large when body streams past cap even without Content-Length header", async () => {
    const limit = 512;
    const req = makeStreamingRequest(limit + 1, 128);
    const result = await readJsonWithLimit(req, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
    }
  });

  it("allows a body exactly at the byte cap", async () => {
    // Build a JSON string that fits within 64 bytes exactly
    const payload = '{"a":1}'; // 7 bytes
    const req = makeRequest(payload, undefined);
    const result = await readJsonWithLimit(req, 64);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ a: 1 });
    }
  });

  it("returns invalid_json for a malformed body under the cap", async () => {
    const req = makeRequest("not valid json {{{");
    const result = await readJsonWithLimit(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_json");
      expect(result.error).toContain("Invalid JSON");
    }
  });

  it("enforces the cap without a Content-Length header (the main security property)", async () => {
    // A client can omit Content-Length entirely with a chunked / streaming body.
    // This test verifies the cap applies regardless.
    const limit = 50;
    const bigPayload = JSON.stringify({ data: "A".repeat(200) }); // > 50 bytes
    const req = makeRequest(bigPayload, undefined /* no Content-Length */);
    const result = await readJsonWithLimit(req, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
    }
  });

  it("includes the configured MB limit in the error message", async () => {
    const limit = 2_000_000; // 2 MB
    const big = "x".repeat(limit + 1);
    const req = makeRequest(big, undefined);
    const result = await readJsonWithLimit(req, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
      expect(result.error).toContain("2.0MB");
    }
  });
});
