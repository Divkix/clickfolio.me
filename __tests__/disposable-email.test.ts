import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetCache,
  extractDomain,
  isDisposableEmail,
  TRUSTED_DOMAINS,
} from "@/lib/email/disposable-check";

describe("extractDomain", () => {
  it("extracts domain from standard email", () => {
    expect(extractDomain("user@gmail.com")).toBe("gmail.com");
  });

  it("extracts domain from email with plus alias", () => {
    expect(extractDomain("user+tag@gmail.com")).toBe("gmail.com");
  });

  it("extracts domain from email with subdomain", () => {
    expect(extractDomain("user@mail.example.com")).toBe("mail.example.com");
  });

  it("returns null for email without @", () => {
    expect(extractDomain("noatsign")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDomain("")).toBeNull();
  });

  it("returns null for email with empty domain", () => {
    expect(extractDomain("user@")).toBeNull();
  });

  it("handles multiple @ by using last one", () => {
    expect(extractDomain("user@@domain.com")).toBe("domain.com");
  });

  it("lowercases domain", () => {
    expect(extractDomain("user@GMAIL.COM")).toBe("gmail.com");
  });

  it("lowercases mixed case domain", () => {
    expect(extractDomain("User@GmAiL.cOm")).toBe("gmail.com");
  });

  it("returns null for @ only", () => {
    expect(extractDomain("@")).toBeNull();
  });
});

describe("TRUSTED_DOMAINS", () => {
  it("contains gmail.com", () => {
    expect(TRUSTED_DOMAINS.has("gmail.com")).toBe(true);
  });

  it("contains outlook.com", () => {
    expect(TRUSTED_DOMAINS.has("outlook.com")).toBe(true);
  });

  it("contains yahoo.com", () => {
    expect(TRUSTED_DOMAINS.has("yahoo.com")).toBe(true);
  });

  it("contains icloud.com", () => {
    expect(TRUSTED_DOMAINS.has("icloud.com")).toBe(true);
  });

  it("contains protonmail.com", () => {
    expect(TRUSTED_DOMAINS.has("protonmail.com")).toBe(true);
  });

  it("contains hotmail.com", () => {
    expect(TRUSTED_DOMAINS.has("hotmail.com")).toBe(true);
  });

  it("does not contain obviously disposable domains", () => {
    expect(TRUSTED_DOMAINS.has("mailinator.com")).toBe(false);
    expect(TRUSTED_DOMAINS.has("guerrillamail.com")).toBe(false);
    expect(TRUSTED_DOMAINS.has("tempmail.com")).toBe(false);
  });
});

describe("isDisposableEmail", () => {
  beforeEach(() => {
    _resetCache();
  });

  function createMockKV(domains: string[] | null): KVNamespace {
    return {
      get: vi.fn().mockResolvedValue(domains ? JSON.stringify(domains) : null),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;
  }

  it("returns { disposable: false } for trusted domain (skips KV)", async () => {
    const kv = createMockKV(["mailinator.com"]);
    const result = await isDisposableEmail("user@gmail.com", kv);
    expect(result.disposable).toBe(false);
    // Should NOT call KV for trusted domains
    expect(kv.get).not.toHaveBeenCalled();
  });

  it("returns { disposable: true } for exact disposable match", async () => {
    const kv = createMockKV(["mailinator.com", "tempmail.com"]);
    const result = await isDisposableEmail("user@mailinator.com", kv);
    expect(result.disposable).toBe(true);
  });

  it("returns { disposable: false } for unknown domain (allowed)", async () => {
    const kv = createMockKV(["mailinator.com"]);
    const result = await isDisposableEmail("user@mycompany.com", kv);
    expect(result.disposable).toBe(false);
  });

  it("fails open when KV is null", async () => {
    const result = await isDisposableEmail("user@mailinator.com", null);
    expect(result.disposable).toBe(false);
  });

  it("fails open when KV throws", async () => {
    const kv = {
      get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;

    const result = await isDisposableEmail("user@mailinator.com", kv);
    expect(result.disposable).toBe(false);
  });

  it("case-insensitive matching", async () => {
    const kv = createMockKV(["mailinator.com"]);
    const result = await isDisposableEmail("user@MAILINATOR.COM", kv);
    expect(result.disposable).toBe(true);
  });

  it("returns { disposable: false } for invalid email format", async () => {
    const kv = createMockKV(["mailinator.com"]);
    const result = await isDisposableEmail("notanemail", kv);
    expect(result.disposable).toBe(false);
  });

  it("returns { disposable: false } for empty email", async () => {
    const kv = createMockKV(["mailinator.com"]);
    const result = await isDisposableEmail("", kv);
    expect(result.disposable).toBe(false);
  });

  it("returns { disposable: false } when KV returns null (empty blocklist)", async () => {
    const kv = createMockKV(null);
    const result = await isDisposableEmail("user@mailinator.com", kv);
    expect(result.disposable).toBe(false);
  });
});
