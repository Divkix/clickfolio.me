import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({ env: {} }));

function requestWith(headers: Record<string, string>) {
  return new Request("https://clickfolio.me/api/upload", { headers });
}

describe("getClientIP", () => {
  it("prefers CF-Connecting-IP over X-Forwarded-For", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    expect(
      getClientIP(
        requestWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", "cf-connecting-ip": "192.168.1.1" }),
      ),
    ).toBe("192.168.1.1");
  });

  it("falls back to the first X-Forwarded-For entry when CF-Connecting-IP is absent", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    expect(getClientIP(requestWith({ "x-forwarded-for": "192.168.1.1, 10.0.0.1" }))).toBe(
      "192.168.1.1",
    );
  });

  it("accepts IPv6 in full, compressed and IPv4-mapped forms", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    for (const ip of ["2001:0db8:85a3:0000:0000:8a2e:0370:7334", "2001:db8::1", "::ffff:1.2.3.4"]) {
      expect(getClientIP(requestWith({ "cf-connecting-ip": ip }))).toBe(ip);
    }
  });

  it("answers unknown when no header is present", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    expect(getClientIP(requestWith({}))).toBe("unknown");
  });

  it("maps header text that is not an IP address to the shared unknown bucket", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    for (const junk of [
      "real-ip",
      "1.2.3.4:8080",
      "999.1.1.1",
      "[::1]",
      "fe80::1%eth0",
      "a".repeat(5000),
    ]) {
      expect(getClientIP(requestWith({ "cf-connecting-ip": junk }))).toBe("unknown");
      expect(getClientIP(requestWith({ "x-forwarded-for": `${junk}, 1.2.3.4` }))).toBe("unknown");
    }
  });

  it("does not fall through to X-Forwarded-For when CF-Connecting-IP is junk", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    expect(
      getClientIP(requestWith({ "cf-connecting-ip": "junk", "x-forwarded-for": "1.2.3.4" })),
    ).toBe("unknown");
  });
});
