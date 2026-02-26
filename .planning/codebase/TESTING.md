# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: jsdom (browser environment for unit tests)
- Globals enabled: `globals: true` (no need to import describe/it/expect)

**Assertion Library:**
- Vitest's built-in expect (compatible with Jest API)

**Run Commands:**
```bash
bun run test              # Run all tests in __tests__/
bun run test:watch       # Watch mode
bunx vitest run __tests__/referral.test.ts          # Run single test file
bunx vitest run __tests__/referral.test.ts -t "name" # Run single test by name
bun run ci               # type-check + lint + test + build (CI pipeline)
```

**Coverage:**
- Provider: v8
- Reporters: text, json-summary
- Include: `lib/**`, `app/api/**`
- Exclude: `**/*.d.ts`, `**/*.test.*`, `lib/stubs/**`
- Target: 95%+ edge case coverage required (see project instructions)

## Test File Organization

**Location:**
- All tests in `__tests__/` directory (co-located at project root)
- Pattern: `__tests__/{feature}.test.ts` or `__tests__/{feature}.test.tsx`
- Setup file: `__tests__/setup.ts` (creates localStorage mock for jsdom)

**Test Files:**
```
__tests__/
├── referral.test.ts              # Client-side referral utilities
├── privacy.test.ts               # Privacy settings functions
├── resume-schema.test.ts          # Zod schema validation
├── profile-schema.test.ts         # Profile validation
├── claim-flow.test.ts             # POST /api/resume/claim
├── idor-ownership.test.ts         # Authorization checks
├── milestones.test.ts             # Milestone/confetti logic
├── email-verification.test.ts     # Email sending
├── disposable-email.test.ts       # Disposable email detection
├── password-strength.test.ts      # Password validation
├── sanitization.test.ts           # XSS prevention
├── share.test.ts                  # Share logic
├── sync-disposable-domains.test.ts # Domain list sync
└── setup.ts                       # Global setup (localStorage mock)
```

**Naming:**
- Test file name matches feature name: `referral.test.ts` tests `lib/referral.ts`
- Tests for route handlers include route path: `claim-flow.test.ts` for `/api/resume/claim`
- Tests for authorization include `idor-` prefix: `idor-ownership.test.ts`

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";
import { captureReferralCode } from "@/lib/referral";

describe("referral client-side utilities", () => {
  describe("captureReferralCode", () => {
    it("stores code in localStorage", () => {
      captureReferralCode("ABC12345");
      expect(localStorage.getItem("referral_code")).toBe("ABC12345");
    });

    it("converts code to uppercase", () => {
      captureReferralCode("abc12345");
      expect(localStorage.getItem("referral_code")).toBe("ABC12345");
    });
  });

  describe("getStoredReferralCode", () => {
    it("returns stored code", () => {
      localStorage.setItem("referral_code", "ABC12345");
      expect(getStoredReferralCode()).toBe("ABC12345");
    });
  });
});
```

**Patterns:**
- Nested `describe()` blocks group by function
- Each `it()` tests single behavior
- Setup/teardown via `beforeEach()` and `afterEach()`
- Mock setup at top of file in comments block labeled `// ── Mocks`

**Setup/Teardown:**
```typescript
import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("API_KEY", "test_123");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});
```

**localStorage Setup:**
- File `__tests__/setup.ts` creates global localStorage mock
- Automatically cleared before/after each test (jsdom may not provide proper mock in bun)
- Mock implementation includes all standard methods: getItem, setItem, removeItem, clear, key, length

## Mocking

**Framework:** Vitest's `vi` module

**Patterns for Module Mocks:**
```typescript
vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

// Later, at test time:
const mockedAuth = vi.mocked(requireAuthWithUserValidation);
mockedAuth.mockResolvedValue({
  user: { id: "user-1", email: "test@test.com" },
  error: null,
});
```

**Patterns for Function Mocks:**
```typescript
const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);
const mockR2Put = vi.fn().mockResolvedValue(undefined);
const mockDbSelect = vi.fn();

// Chain mocks for fluent APIs:
mockDbSelect.mockReturnValue({ from: mockDbFrom });
mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ limit: mockDbLimit });
mockDbLimit.mockResolvedValue([]);

// Reset all mocks before each test:
beforeEach(() => {
  vi.clearAllMocks();
  // Re-setup chains after clearing:
  mockDbSelect.mockReturnValue({ from: mockDbFrom });
});
```

**What to Mock:**
- External services: R2, email providers, analytics APIs
- Database operations when testing business logic (not integration tests)
- Authentication when testing authorization
- HTTP requests (fetch, ofetch)

**What NOT to Mock:**
- Zod schemas — test actual validation logic
- Utility functions — test real behavior
- Database schema/types — import real definitions

**Environment Variables:**
```typescript
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_123456789");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

## Fixtures and Factories

**Test Data:**
```typescript
/**
 * Minimal valid resume fixture.
 * Mutate individual fields in each test to verify single-field rejection.
 */
const validMinimalResume = {
  full_name: "Jane Doe",
  headline: "Software Engineer",
  summary: "Experienced software engineer...",
  contact: {
    email: "jane@example.com",
  },
  experience: [
    {
      title: "Senior Engineer",
      company: "Acme Corp",
      start_date: "2020-01",
      description: "Led the platform team.",
    },
  ],
};

// In tests, mutate the fixture:
const result = await resumeContentSchema.safeParseAsync({
  ...validMinimalResume,
  full_name: "A".repeat(201), // Test: reject > 200 chars
});
```

**Factories:**
```typescript
function makePdfBuffer(): ArrayBuffer {
  const header = new TextEncoder().encode("%PDF-1.4 fake content");
  return header.buffer.slice(header.byteOffset, header.byteOffset + header.byteLength);
}

function authedAs(userId: string) {
  mockedAuth.mockResolvedValue({
    user: { id: userId, email: `${userId}@test.com`, ... },
    error: null,
  });
}

function makeClaimRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/resume/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

**Location:**
- Fixtures and helpers defined at top of test file after imports
- Shared fixtures in dedicated `__tests__/fixtures/` if reused across tests (currently inline)

## Coverage

**Requirements:** 95%+ coverage for edge cases (strict TDD+Trophy per project instructions)

**View Coverage:**
```bash
bun run test  # Outputs text coverage report
```

**Include:**
- All library functions must have tests covering happy path and errors
- Schema validation tests include both acceptance and rejection cases
- Authorization tests cover both owner access and IDOR attempts

**Exclude from Coverage:**
- `lib/stubs/` — dead code stubs, intentionally uncovered
- Type definition files (`.d.ts`)
- Test files themselves

## Test Types

**Unit Tests:**
- Scope: Single function or module in isolation
- Approach: Mock all dependencies
- Examples: `referral.test.ts` (utilities), `privacy.test.ts` (validation)
- No database or network calls
- Fast execution (< 100ms per test)

**Integration Tests:**
- Scope: Multiple layers together (auth + DB + API route)
- Approach: Mock external services (R2, email), use real Drizzle queries
- Examples: `claim-flow.test.ts` (API endpoint), `idor-ownership.test.ts` (authorization)
- May use test database in future; currently mocks DB layer
- Moderate execution time (< 500ms per test)

**E2E Tests:**
- Not used currently
- Framework: Not selected (future: Playwright mentioned in package.json, not yet integrated)
- Could test browser-based flows with real API calls

## Common Patterns

**Async Testing:**
```typescript
it("handles async operations", async () => {
  const result = await resumeContentSchema.safeParseAsync(validMinimalResume);
  expect(result.success).toBe(true);
});

// With resolve/reject patterns:
it("resolves with correct value", async () => {
  const result = await requestPasswordReset({
    email: "user@example.com",
    redirectTo: "/reset",
  });
  expect(result.error).toBeNull();
});
```

**Error Testing:**
```typescript
describe("rejection cases", () => {
  it("rejects missing required field", async () => {
    const { full_name: _, ...noName } = validMinimalResume;
    const result = await resumeContentSchema.safeParseAsync(noName);
    expect(result.success).toBe(false);
  });

  it("includes specific error message", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      headline: "<script>xss</script>",
    });
    if (!result.success) {
      const issue = result.error.issues.find((e) => e.path.includes("headline"));
      expect(issue?.message).toBe("Invalid content detected");
    }
  });
});
```

**HTTP Request Mocking:**
```typescript
it("sends verification email successfully", async () => {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: "email_123" }),
  }) as unknown as typeof fetch;

  const result = await sendVerificationEmail({ email: "test@example.com", ... });

  expect(result.success).toBe(true);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer re_test_123456789",
      }),
    }),
  );
});
```

**Error Path Testing:**
```typescript
it("handles API errors gracefully", async () => {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ message: "Rate limit exceeded" }),
  }) as unknown as typeof fetch;

  const result = await sendVerificationEmail({ ... });

  expect(result.success).toBe(false);
  expect(result.error).toContain("Rate limit");
});

it("handles network errors gracefully", async () => {
  globalThis.fetch = vi.fn().mockRejectedValueOnce(
    new Error("Network error")
  ) as unknown as typeof fetch;

  const result = await sendVerificationEmail({ ... });

  expect(result.success).toBe(false);
  expect(result.error).toBe("Network error");
});
```

**Schema Transformation Testing:**
```typescript
it("transforms sanitized URLs (blocks dangerous protocols)", async () => {
  const result = await resumeContentSchema.safeParseAsync({
    ...validMinimalResume,
    contact: { email: "jane@example.com", website: "https://example.com" },
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.contact.website).toBe("https://example.com");
  }
});

it("sanitizes javascript: URL to empty string", async () => {
  const result = await resumeContentSchema.safeParseAsync({
    ...validMinimalResume,
    contact: { email: "jane@example.com", linkedin: "javascript:alert(1)" },
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.contact.linkedin).toBe(""); // Sanitized
  }
});
```

**Boundary/Edge Case Testing:**
```typescript
describe("edge cases", () => {
  it("rejects full_name exceeding 200 characters", () => {
    const result = resumeContentSchema.parseSync({
      ...validMinimalResume,
      full_name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("handles empty arrays gracefully", () => {
    const result = resumeContentSchema.parseSync({
      ...validMinimalResume,
      experience: [],
    });
    expect(result.success).toBe(true); // Empty is allowed
  });

  it("rejects more than 10 experience entries", () => {
    const entry = { title: "Eng", company: "Corp", start_date: "2020", description: "Work" };
    const result = resumeContentSchema.parseSync({
      ...validMinimalResume,
      experience: Array.from({ length: 11 }, () => ({ ...entry })),
    });
    expect(result.success).toBe(false);
  });
});
```

---

*Testing analysis: 2026-02-26*
