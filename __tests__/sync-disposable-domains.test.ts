import { afterEach, describe, expect, it, vi } from "vitest";
import { syncDisposableDomains } from "@/lib/cron/sync-disposable-domains";

function createKvMock() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function mockFetchResponse(body: string, status = 200) {
  return vi.fn().mockResolvedValue(new Response(body, { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncDisposableDomains", () => {
  it("fetches, parses, and stores domains in KV", async () => {
    const domains = Array.from({ length: 1500 }, (_, i) => `domain${i}.com`);
    const body = domains.join("\n");
    vi.stubGlobal("fetch", mockFetchResponse(body));
    const kv = createKvMock();

    const result = await syncDisposableDomains(kv);

    expect(fetch).toHaveBeenCalledOnce();
    expect(kv.put).toHaveBeenCalledOnce();
    const [key, value] = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("disposable-domains");
    const stored: string[] = JSON.parse(value);
    expect(stored).toHaveLength(1500);
    expect(stored[0]).toBe("domain0.com");
    expect(result.ok).toBe(true);
    expect(result.domainCount).toBe(1500);
    expect(result.timestamp).toBeTruthy();
  });

  it("throws when GitHub returns non-200 status", async () => {
    vi.stubGlobal("fetch", mockFetchResponse("Server Error", 500));
    const kv = createKvMock();

    await expect(syncDisposableDomains(kv)).rejects.toThrow();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("throws when parsed domains fewer than 1000 (sanity check)", async () => {
    const domains = Array.from({ length: 500 }, (_, i) => `domain${i}.com`);
    vi.stubGlobal("fetch", mockFetchResponse(domains.join("\n")));
    const kv = createKvMock();

    await expect(syncDisposableDomains(kv)).rejects.toThrow();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("filters out empty lines and comment lines starting with #", async () => {
    const lines = [
      ...Array.from({ length: 1200 }, (_, i) => `domain${i}.com`),
      "",
      "   ",
      "# This is a comment",
      "#another-comment.com",
    ];
    vi.stubGlobal("fetch", mockFetchResponse(lines.join("\n")));
    const kv = createKvMock();

    const result = await syncDisposableDomains(kv);

    const stored: string[] = JSON.parse((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][1]);
    expect(stored).toHaveLength(1200);
    expect(stored.every((d) => d !== "" && !d.startsWith("#"))).toBe(true);
    expect(result.domainCount).toBe(1200);
  });

  it("lowercases all domain entries", async () => {
    const lines = [
      ...Array.from({ length: 1100 }, (_, i) => `domain${i}.com`),
      "UPPERCASE.COM",
      "MiXeD.CaSe.OrG",
    ];
    vi.stubGlobal("fetch", mockFetchResponse(lines.join("\n")));
    const kv = createKvMock();

    const result = await syncDisposableDomains(kv);

    const stored: string[] = JSON.parse((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][1]);
    expect(stored).toContain("uppercase.com");
    expect(stored).toContain("mixed.case.org");
    expect(stored.every((d) => d === d.toLowerCase())).toBe(true);
    expect(result.domainCount).toBe(1102);
  });
});
