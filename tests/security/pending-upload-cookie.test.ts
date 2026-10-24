import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createSignedCookieValue,
  decodePendingUploadCookie,
  parseSignedCookieValue,
} from "@/lib/utils/pending-upload-cookie";

const SECRET = "test-pending-upload-secret";

const KEY = "temp/11111111-1111-4111-8111-111111111111/resume.pdf";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("pending upload cookie", () => {
  it("round-trips a key signed with HMAC-SHA256", async () => {
    const value = await createSignedCookieValue(KEY, SECRET);
    const [tempKey, expiresAt, signature] = value.split("|");

    expect(signature).toBe(
      createHmac("sha256", SECRET).update(`${tempKey}|${expiresAt}`).digest("base64"),
    );
    expect(await parseSignedCookieValue(value, SECRET)).toEqual({ tempKey: KEY });
  });

  it("rejects a value signed with another secret", async () => {
    const value = await createSignedCookieValue(KEY, SECRET);

    expect(await parseSignedCookieValue(value, "another-secret")).toBeNull();
  });

  it("rejects a tampered key", async () => {
    const value = await createSignedCookieValue(KEY, SECRET);
    const forged = value.replace("11111111-1111", "99999999-9999");

    expect(await parseSignedCookieValue(forged, SECRET)).toBeNull();
  });

  it("rejects an expired value", async () => {
    vi.useFakeTimers();

    const value = await createSignedCookieValue(KEY, SECRET);

    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(await parseSignedCookieValue(value, SECRET)).toBeNull();
  });

  it.each([
    ["no separators", "temp-key"],
    ["too few parts", `${KEY}|123`],
    ["too many parts", `${KEY}|123|sig|extra`],
    ["an empty key", "|123|sig"],
    ["a non-numeric expiry", `${KEY}|soon|sig`],
    ["a signed-looking expiry", `${KEY}|-1|sig`],
    ["an empty signature", `${KEY}|123|`],
    ["an empty value", ""],
  ])("rejects %s without checking a signature", async (_label, value) => {
    const importKey = vi.spyOn(crypto.subtle, "importKey");

    expect(await parseSignedCookieValue(value, SECRET)).toBeNull();
    expect(importKey).not.toHaveBeenCalled();
  });

  it("derives the HMAC key on every call instead of caching it", async () => {
    const importKey = vi.spyOn(crypto.subtle, "importKey");

    await createSignedCookieValue(KEY, SECRET);
    await createSignedCookieValue(KEY, SECRET);

    expect(importKey).toHaveBeenCalledTimes(2);
  });
});

describe("decodePendingUploadCookie", () => {
  it("decodes the percent-encoded separator the cookie store writes", () => {
    expect(decodePendingUploadCookie("temp%2Fabc%7C123%7Csig")).toBe("temp/abc|123|sig");
  });

  it("answers null for malformed percent-encoding", () => {
    expect(decodePendingUploadCookie("%E0%A4%A")).toBeNull();
  });
});
