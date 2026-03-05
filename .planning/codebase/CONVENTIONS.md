# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Lowercase with hyphens for multi-word files: `auth-middleware.ts`, `rate-limit.ts`, `email-verification.ts`
- Component files use PascalCase: `DashboardUploadSection.tsx`, `RealtimeStatusListener.tsx`, `EmailVerificationBanner.tsx`
- Utility modules descriptive and scoped: `lib/utils/sanitization.ts`, `lib/utils/privacy.ts`, `lib/queue/resume-parse.ts`
- Schema and type files grouped: `lib/schemas/resume.ts`, `lib/types/database.ts`, `lib/types/template.ts`
- API route files use conventional patterns: `app/api/resume/claim/route.ts`, `app/api/auth/[...all]/route.ts`

**Functions:**
- camelCase for all function names: `captureReferralCode()`, `extractCityState()`, `sanitizeText()`
- Prefix with verb when action-oriented: `validatePDF()`, `sanitizeUrl()`, `normalizePrivacySettings()`
- Query/getter functions start with `get`: `getStoredReferralCode()`, `getServerSession()`, `getR2Binding()`
- Predicate/guard functions start with `is`/`has`/`contains`: `isValidPrivacySettings()`, `isDisposableEmail()`, `containsXssPattern()`
- Async functions use async/await, no special naming prefix

**Variables:**
- camelCase for all variables: `referralCode`, `emailVerified`, `clickCount`
- Constants in UPPER_SNAKE_CASE: `REFERRAL_CODE_KEY`, `MAX_FILE_SIZE`, `LENIENT_EMAIL_REGEX`
- Prefix mocks in tests with `mock`: `mockCaptureBookmark`, `mockDbSelect`, `mockR2Put()`
- Boolean variables start with prefix: `isOAuthUser`, `emailVerified`, `hasExceededMaxAttempts()`
- Result/status variables use descriptive names: `userData`, `siteDataResult`, `clickCountResult`

**Types & Interfaces:**
- PascalCase for all types: `ResumeContent`, `PrivacySettings`, `CloudflareEnv`
- Custom schema types use `Infer` suffix from Drizzle: `typeof siteData.$inferSelect`
- Zod schemas in lowercase with `Schema` suffix: `resumeContentSchema`, `resumeContentSchemaStrict`, `profileSchema`
- Type imports from libraries use explicit `type` keyword: `import type { Resume, siteData } from "@/lib/db/schema"`

**Database:**
- Tables lowercase with snake_case: `user`, `resumes`, `referralClicks`, `siteData`
- Column names use snake_case: `email_verified`, `created_at`, `referral_code`, `privacy_settings`
- Index names follow pattern: `user_handle_idx`, `session_user_id_idx`, `user_show_in_directory_idx`
- Relations file suffix: `relations` (e.g., Drizzle relations in schema file)

## Code Style

**Formatting:**
- Biome enforces all formatting via `biome check --write`
- 2-space indentation (configured in `biome.json`)
- 100-character line width limit
- Double quotes required (no single quotes)
- Semicolons required at end of statements
- Trailing commas in multi-line objects/arrays

**Linting:**
- Biome rules at `biome.json`: `noUnusedVariables: error`, `noUnusedImports: error`
- Warnings allowed: `noExplicitAny: warn`, `a11y` rules as warnings
- Run `bun run lint` to check, `bun run fix` to auto-correct

**Line Ending:**
- LF line endings (`\n`) enforced

## Import Organization

**Order:**
1. Node.js built-in modules: `import { resolve } from "node:path"`
2. Third-party dependencies: `import { z } from "zod"`, `import { eq } from "drizzle-orm"`
3. vinext/Next.js framework: `import { redirect } from "next/navigation"`, `import Link from "next/link"`
4. Internal imports: `import { getDb } from "@/lib/db"`, `import { Button } from "@/components/ui/button"`
5. Relative imports rarely used (path aliases preferred)

**Path Aliases:**
- `@/` maps to project root (configured in `tsconfig.json` and `vitest.config.ts`)
- Use `@/lib/*` for library code, `@/components/*` for components, `@/app/*` for routes

**Import Organization Assist:**
- Biome's `assist.actions.source.organizeImports` enabled — use via editor command or `bun run fix`

**Barrel Files:**
- Used rarely; most imports are direct to modules (avoids over-bundling)
- Component libraries may re-export from `index.ts` for cleaner imports

## Error Handling

**Pattern:**
- Functions return `{ success: boolean; error?: string }` or `{ success: boolean; reason?: string }` for validation
- Example: `writeReferral()` returns `{ success: boolean; reason?: string }`
- API handlers use try-catch with error classification
- Fallback to defaults on JSON parse errors (e.g., privacy settings default to falsy)

**Server vs. Client:**
- Server functions throw or return error responses directly
- Client hooks use try-catch and return `{ data: T | null; error: Error | null }`
- Example: `requestPasswordReset()` returns both data and error fields

**Validation:**
- Zod schemas used for input validation, prefer `safeParseAsync()` over `.parse()`
- Lenient vs. strict schema pattern: `resumeContentSchema` (AI-parsed) vs. `resumeContentSchemaStrict` (user edits)
- Validation errors include specific error messages and path information
- Sanitization is part of schema transformation (e.g., `.transform(sanitizeText)`)

**Error Messages:**
- Descriptive but not verbose: `"Invalid email format (must include domain extension, e.g., .com)"`
- Include context when available: `"Cannot find module 'fs' — You're on Workers, use R2 bindings"`
- Silent failures on non-critical operations (e.g., post-success referral operations in `writeReferral()`)

**Exception Handling:**
- Catch-all blocks log errors but don't fail critical operations
- Example in `writeReferral()`: best-effort referral click conversion after user link is persisted

## Logging

**Framework:** No logger library — uses `console` methods directly

**Patterns:**
- `console.error()` for exceptions: `console.error("Failed to complete post-referral operations:", error)`
- `console.log()` for debug info in development (rarely needed)
- Error logs include context and stack trace

**Best Practices:**
- Log at failure point, include error object
- Avoid logging sensitive data (passwords, tokens, emails in logs)

## Comments

**When to Comment:**
- High-level explanations of complex logic (e.g., "Atomic conditional update to prevent TOCTOU race conditions")
- Security considerations (e.g., XSS prevention, CSRF protection)
- Non-obvious optimizations (e.g., "Compute both visitor hashes in parallel instead of sequentially")
- Architecture decisions (e.g., "WeakMap for caching ensures automatic cleanup on isolate recycle")

**JSDoc/TSDoc:**
- Used extensively in `lib/` modules for public functions
- Include `@param`, `@returns`, `@example` for API documentation
- Example from `lib/referral.ts`:
```typescript
/**
 * Store referral code in localStorage (first ref wins)
 *
 * @param code - The referrer's referral code from ?ref= param
 */
export function captureReferralCode(code: string): void {
```

**Inline Comments:**
- Used for algorithm explanations and non-obvious control flow
- Example: `// Prevent self-referral` above conditional check
- Section dividers: `// ── Client-side functions ──────────────────────────────────`

## Function Design

**Size:**
- Prefer functions under 50 lines; complex logic broken into helpers
- Large data fetches use Promise.all for parallel queries (e.g., dashboard query)
- Database operations composed from simpler atomic operations

**Parameters:**
- Typed explicitly; never use implicit `any`
- Destructured when multiple related params: `{ email, redirectTo }` preferred over individual args
- Optional params use `?:` and checked before use
- Request/headers passed as params, not extracted globally in route handlers

**Return Values:**
- Explicit return type annotations required
- Void functions only when side effects are primary purpose
- Error-first patterns: `{ success: boolean; error?: string }`
- Consistent response shape across similar functions

**Examples:**
- `captureReferralCode(code: string): void` — mutation only
- `getStoredReferralCode(): string | null` — simple getter
- `writeReferral(...): Promise<{ success: boolean; reason?: string }>` — async with result object

## Module Design

**Exports:**
- Prefer named exports: `export function doThing() {}`
- Default exports rare (only for page components in vinext)
- All public APIs typed with explicit return types

**Barrel Files:**
- Avoided for most code; each file imports exactly what it needs
- Reduces bundle size by avoiding circular dependencies and dead code

**Layering:**
- `lib/utils/*` — pure utility functions, no side effects
- `lib/db/*` — database schemas and queries
- `lib/auth/*` — authentication utilities
- `lib/queue/*` — async queue consumers
- `lib/email/*` — email sending services
- `components/*` — React components
- `app/` — vinext pages and API routes

**Dependencies:**
- Lower layers (utils, db) never import from higher layers (components, app)
- Cross-layer imports allowed: app/components can import from lib
- Avoid circular dependencies; use re-export pattern if needed

## Security & Validation

**Input Sanitization:**
- All user input sanitized before storage: `sanitizeText()`, `sanitizeUrl()`, `sanitizeEmail()`
- XSS pattern check: `noXssPattern()` applied to text fields
- URLs validated and dangerous protocols stripped (javascript:, data:, etc.)

**Database Access:**
- Parameterized queries via Drizzle ORM (never string concatenation)
- SQL injection impossible; relational operators (`eq`, `and`, `or`) prevent manual query building

**Type Safety:**
- Strict TypeScript with `noImplicitAny: warn` (warnings allowed, not errors)
- Database types derived from schema via `$inferSelect`

---

*Convention analysis: 2026-02-26*
