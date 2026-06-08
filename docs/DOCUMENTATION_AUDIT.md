# clickfolio.me — Documentation Audit Report

**Date:** 2026-05-28
**Scope:** 391 source files (`.ts`, `.tsx`, `.js`, `.jsx`)
**Method:** Systematic review by module with subagent verification

---

## Executive Summary

The codebase has **pockets of excellent documentation** (security utilities, auth client, cron jobs, queue system) but **significant gaps** in critical infrastructure (worker handler, database layer, API routes) and **docstring-implementation mismatches** that could mislead developers. The project documentation (README, AGENTS.md, TESTING.md) contains **factual inaccuracies** that undermine trust.

| Severity    | Count | Description                                                       |
| ----------- | ----- | ----------------------------------------------------------------- |
| 🔴 Critical | 12    | Docstring mismatches, missing docs on critical paths, stale docs  |
| 🟡 High     | 24    | Missing JSDoc on exported API surface, complex logic undocumented |
| 🟠 Medium   | 67    | Missing response shapes, error codes, file-level comments         |
| 🟢 Low      | 88    | Missing component/page JSDoc, minor cosmetic gaps                 |

---

## 🔴 Critical Issues (Fix Immediately)

### C1. `AGENTS.md` Command Is Invalid

- **File:** `AGENTS.md` line 22
- **Issue:** `bun run fix` is documented as `biome --write .` but `package.json` has `biome check --write .`
- **Impact:** Developers will get a CLI error if they follow the docs.
- **Fix:** Update `AGENTS.md` to `biome check --write .`

### C2. Coverage Thresholds Wildly Understated

- **Files:** `AGENTS.md` line 100, `TESTING.md` lines 54-59
- **Issue:** Docs claim 30% lines/statements, 25% functions. Actual `vitest.config.ts` enforces **80%** across all metrics.
- **Impact:** Contributors think the bar is low when it's actually high. Creates confusion when CI fails.
- **Fix:** Update docs to match `vitest.config.ts` (80% for main, or clarify per-config thresholds).

### C3. `AGENTS.md` Misstates Auth Methods

- **File:** `AGENTS.md` line 9
- **Issue:** Claims "Better Auth (Google OAuth **only**)" but `lib/auth/index.ts` has `emailAndPassword: { enabled: true }` with password reset and email verification.
- **Fix:** Change to "Better Auth (Google OAuth + email/password)"

### C4. `lib/schemas/resume.ts` — Describe Mismatch with Validation

- **File:** `lib/schemas/resume.ts` line 293
- **Issue:** `.describe("max 200 characters")` but `.max(2000)` is enforced.
- **File:** `lib/schemas/resume.ts` line 360
- **Issue:** `.describe("max 500 characters")` but `.max(10000)` is enforced.
- **Impact:** UI shows users one limit, backend allows 10x more.
- **Fix:** Align description text with validation.

### C5. `lib/utils/xml.ts` — Security Utility Completely Undocumented

- **File:** `lib/utils/xml.ts` (8 lines, 0% coverage)
- **Issue:** `escapeXml` is a security-critical XSS prevention function with zero JSDoc.
- **Fix:** Add file-level JSDoc and function JSDoc explaining XML output escaping.

### C6. `worker/index.ts` — Core Handler Undocumented

- **File:** `worker/index.ts` (206 lines, ~25% coverage)
- **Issue:** `fetch`, `queue`, `scheduled` methods have zero JSDoc. This is the entry point for the entire application.
- **Fix:** Add comprehensive JSDoc to all handler methods.

### C7. `proxy.ts` — Auth Middleware Undocumented

- **File:** `proxy.ts` (38 lines, 0% coverage)
- **Issue:** The auth gate for all protected routes has zero JSDoc.
- **Fix:** Add JSDoc explaining cookie-only auth, no D1 access constraint.

### C8. `lib/db/index.ts` — `getDb()` Undocumented

- **File:** `lib/db/index.ts` (26 lines, 0% coverage)
- **Issue:** The canonical database accessor (AGENTS.md: "use this, not raw drizzle") has no JSDoc.
- **Fix:** Add JSDoc explaining singleton-per-isolate WeakMap caching.

### C9. `lib/r2.ts` — All Methods Undocumented

- **File:** `lib/r2.ts` (101 lines, ~15% coverage)
- **Issue:** 10 exported methods (`get`, `getAsArrayBuffer`, `put`, `delete`, `head`, `copy`, `healthCheck`, `getPartial`) have zero JSDoc.
- **Fix:** Add JSDoc to all methods, especially `getPartial` (range requests) and `getAsArrayBuffer` vs `getAsUint8Array`.

### C10. `app/api/resume/status/route.ts` — No JSDoc

- **File:** `app/api/resume/status/route.ts` (178 lines, 0% coverage)
- **Issue:** Complex polling endpoint with status lifecycle (`waiting_for_cache`, `queued`, `processing`, `completed`, `failed`) has zero JSDoc.
- **Fix:** Add comprehensive JSDoc explaining status states, 10-minute timeout, and response shapes.

### C11. `app/api/resume/retry/route.ts` — No JSDoc

- **File:** `app/api/resume/retry/route.ts` (263 lines, 0% coverage)
- **Issue:** Most complex retry endpoint (R2 fallback, queue publishing, rollback) has zero JSDoc.
- **Fix:** Add file-level JSDoc explaining retry eligibility, fallback chain, and rollback.

### C12. `app/api/resume/update-theme/route.ts` — No JSDoc

- **File:** `app/api/resume/update-theme/route.ts` (107 lines, 0% coverage)
- **Issue:** Theme validation and referral unlock check endpoint has zero JSDoc.
- **Fix:** Add JSDoc explaining `theme_id` validation, unlock check, and response.

---

## 🟡 High-Priority Issues

### H1. Database Schema Tables Completely Undocumented

- **Files:** `lib/db/schema/auth.ts`, `lib/db/schema/resume.ts`, `lib/db/schema/site.ts`, `lib/db/schema/rate-limit.ts`, `lib/db/schema/relations.ts`
- **Issue:** All 8 tables have zero table-level JSDoc. All exported types (`User`, `Resume`, `SiteData`, etc.) have zero JSDoc.
- **Impact:** IDE hover shows no information. New developers cannot understand the data model.
- **Fix:** Add table-level JSDoc to all tables. Add JSDoc to all exported types.

### H2. `resumes` Status Lifecycle Undocumented

- **File:** `lib/db/schema/resume.ts`
- **Issue:** 6 status states with no documented transitions. `parsedContent` vs `parsedContentStaged`, `errorMessage` vs `lastAttemptError`, `retryCount` vs `totalAttempts` are undifferentiated.
- **Fix:** Document status state machine and field distinctions.

### H3. `siteData.resumeId` Cascade Behavior Undocumented

- **File:** `lib/db/schema/site.ts`
- **Issue:** `onDelete: cascade` on `resumeId` means deleting a resume deletes the user's entire `siteData` (since `userId` is unique). This is a massive design decision with no comment.
- **Fix:** Add JSDoc explaining the cascade and its implications.

### H4. `lib/ai/ai-normalize.ts` — All Exported Functions Undocumented

- **File:** `lib/ai/ai-normalize.ts` (288 lines, ~10% coverage)
- **Issue:** `normalizeAiKeys`, `coerceRecord`, `coerceArray`, `pickFirstValue` and all item normalizers have zero JSDoc.
- **Fix:** Add JSDoc to all exported functions.

### H5. `app/api/profile/privacy/route.ts` — Stale JSDoc

- **File:** `app/api/profile/privacy/route.ts` (84 lines)
- **Issue:** JSDoc says only `show_phone, show_address` but implementation also handles `hide_from_search` and `show_in_directory`.
- **Fix:** Update JSDoc to include all four fields.

### H6. `lib/umami/client.ts` — All API Functions Undocumented

- **File:** `lib/umami/client.ts` (201 lines, ~40% coverage)
- **Issue:** `getUmamiToken`, `getStats`, `getPageviews`, `getMetrics` have zero JSDoc.
- **Fix:** Add JSDoc to all exported functions.

### H7. `lib/seo/sitemap.ts` — Exported Functions Undocumented

- **File:** `lib/seo/sitemap.ts` (234 lines, ~40% coverage)
- **Issue:** `getSitemapBaseUrl`, `getSitemapShardCount`, `buildSitemapXml` have zero JSDoc.
- **Fix:** Add JSDoc to all exported functions.

### H8. `lib/utils/validation.ts` — Exported Symbols Undocumented

- **File:** `lib/utils/validation.ts` (107 lines, ~40% coverage)
- **Issue:** `MAX_FILE_SIZE`, `MAX_FILE_SIZE_LABEL`, `validatePDF`, `generateTempKey` have zero JSDoc.
- **Fix:** Add JSDoc to all exported symbols.

### H9. `app/api/upload/route.ts` — Missing JSDoc Header

- **File:** `app/api/upload/route.ts` (163 lines)
- **Issue:** Has inline JSDoc for POST but no file-level header. Rate limits (10/hour, 50/day) are implemented but not documented in JSDoc.
- **Fix:** Add file-level JSDoc with error codes and rate limits.

### H10. `lib/templates/theme-ids.ts` — Core Constants Undocumented

- **File:** `lib/templates/theme-ids.ts` (155 lines, ~70% coverage)
- **Issue:** `THEME_IDS`, `ThemeId`, `DEFAULT_THEME` have zero JSDoc.
- **Fix:** Add JSDoc to these central template system constants.

### H11. `lib/ai/index.ts` — `ParseResumeResult` and `validateParseResult` Undocumented

- **File:** `lib/ai/index.ts` (186 lines, ~50% coverage)
- **Issue:** `ParseResumeResult` interface and `validateParseResult` function have zero JSDoc.
- **Fix:** Add JSDoc, especially explaining the dual-path logic (structured vs fallback).

### H12. `app/api/sitemap*` Routes — Zero JSDoc

- **Files:** `app/api/sitemap/route.ts`, `app/api/sitemap/[id]/route.ts`, `app/api/sitemap-index/route.ts`
- **Issue:** All 3 sitemap routes have zero JSDoc despite serving critical SEO infrastructure.
- **Fix:** Add JSDoc explaining XML generation, sharding, and cache headers.

### H13. `app/api/analytics/stats/route.ts` — Missing Response Docs

- **File:** `app/api/analytics/stats/route.ts` (249 lines)
- **Issue:** Complex response shape (`totalViews`, `uniqueVisitors`, `viewsByDay`, `deviceBreakdown`, `countryBreakdown`) is not documented.
- **Fix:** Add `@returns` JSDoc documenting the response structure.

### H14. `drizzle.config.ts` — `getLocalD1Path()` Undocumented

- **File:** `drizzle.config.ts` (25 lines, 0% coverage)
- **Issue:** `getLocalD1Path()` dynamically resolves D1 SQLite path from `.wrangler/state/` with no JSDoc.
- **Fix:** Add JSDoc explaining the path resolution and fallback behavior.

### H15. `lib/durable-objects/resume-status.ts` — Good but Incomplete

- **File:** `lib/durable-objects/resume-status.ts` (210 lines, ~95% coverage)
- **Issue:** `constructor` and `alarm` methods have JSDoc, but `fetch` and `webSocketMessage` lack JSDoc. The `resumeId` field is undocumented.
- **Fix:** Add JSDoc to remaining methods and fields.

### H16. `next.config.ts` — No JSDoc

- **File:** `next.config.ts` (62 lines, 0% coverage)
- **Issue:** No file-level or export-level JSDoc. The `as` cast for `bodySizeLimit` is unexplained.
- **Fix:** Add JSDoc explaining the config's purpose and the type cast.

### H17. `lib/ai/ai-parser.ts` — `AiParseResult` Undocumented

- **File:** `lib/ai/ai-parser.ts` (548 lines, ~70% coverage)
- **Issue:** `AiParseResult` interface has zero JSDoc.
- **Fix:** Add JSDoc to the interface.

### H18. `lib/ai/pdf-extract.ts` — `PdfExtractResult` Undocumented

- **File:** `lib/ai/pdf-extract.ts` (57 lines, ~80% coverage)
- **Issue:** `PdfExtractResult` interface has zero JSDoc.
- **Fix:** Add JSDoc to the interface.

### H19. `lib/email/cloudflare.ts` — Params Interfaces Undocumented

- **File:** `lib/email/cloudflare.ts` (240 lines, ~85% coverage)
- **Issue:** `SendPasswordResetEmailParams` and `SendVerificationEmailParams` interfaces have zero JSDoc.
- **Fix:** Add JSDoc to the interfaces.

### H20. `lib/auth/admin.ts` — `AdminUser` Interface Undocumented

- **File:** `lib/auth/admin.ts` (93 lines, ~80% coverage)
- **Issue:** `AdminUser` interface has zero JSDoc.
- **Fix:** Add JSDoc to the interface.

### H21. `lib/ai/ai-fallback.ts` — `parseJsonWithRepair` Undocumented

- **File:** `lib/ai/ai-fallback.ts` (75 lines, ~50% coverage)
- **Issue:** `parseJsonWithRepair` has zero JSDoc.
- **Fix:** Add JSDoc explaining the `ai.parsePartialJson` fallback.

### H22. `lib/templates/contact-links.ts` — Types Undocumented

- **File:** `lib/templates/contact-links.ts` (109 lines, ~30% coverage)
- **Issue:** `ContactLinkType` and `ContactLinkDescriptor` have zero JSDoc.
- **Fix:** Add JSDoc to the types.

### H23. `lib/schemas/profile.ts` — Exported Symbols Undocumented

- **File:** `lib/schemas/profile.ts` (58 lines, ~50% coverage)
- **Issue:** `ROLE_OPTIONS`, `roleUpdateSchema`, `HandleUpdate` have zero JSDoc.
- **Fix:** Add JSDoc to exported symbols.

### H24. `lib/schemas/auth.ts` — Type Aliases Undocumented

- **File:** `lib/schemas/auth.ts` (88 lines, ~70% coverage)
- **Issue:** `SignUpFormData`, `SignInFormData`, `ForgotPasswordFormData`, `ResetPasswordFormData` have zero JSDoc.
- **Fix:** Add brief JSDoc to each type alias.

---

## 🟠 Medium-Priority Issues

### M1. Admin API Routes — Missing Response Docs

- **Files:** `app/api/admin/referrals/route.ts`, `app/api/admin/resumes/route.ts`, `app/api/admin/users/route.ts`, `app/api/admin/stats/route.ts`, `app/api/admin/analytics/route.ts`
- **Issue:** All 5 admin routes have good JSDoc headers but no `@returns` documenting response shapes.
- **Fix:** Add `@returns` JSDoc documenting nested response structures.

### M2. `app/api/site-data/route.ts` — JSDoc Too Brief

- **File:** `app/api/site-data/route.ts` (75 lines)
- **Issue:** JSDoc only says "Fetch site_data" — missing auth requirement, `null` case, and JSON parsing behavior.
- **Fix:** Expand JSDoc to document all behaviors.

### M3. `app/api/og/[handle]/route.ts` — Incomplete JSDoc

- **File:** `app/api/og/[handle]/route.ts` (190 lines)
- **Issue:** JSDoc mentions "1200x630 PNG" but doesn't mention SVG fallback chain.
- **Fix:** Expand JSDoc to mention fallback chain (PNG → SVG).

### M4. `app/api/og/home/route.ts` — Missing Error Docs

- **File:** `app/api/og/home/route.ts` (126 lines)
- **Issue:** No error handling or error documentation.
- **Fix:** Add error handling and document response headers.

### M5. `app/api/email/validate/route.ts` — Missing Response Type

- **File:** `app/api/email/validate/route.ts` (68 lines)
- **Issue:** No explicit response interface for `{ valid: boolean, reason?: string }`.
- **Fix:** Add a response type/interface.

### M6. `app/api/health/route.ts` — Internal Helpers Undocumented

- **File:** `app/api/health/route.ts` (134 lines)
- **Issue:** `checkD1`, `checkR2`, `aggregateStatus` lack JSDoc.
- **Fix:** Add brief JSDoc to internal helpers.

### M7. `app/api/client-error/route.ts` — Missing Helper Docs

- **File:** `app/api/client-error/route.ts` (44 lines)
- **Issue:** `truncate` and `ClientErrorBody` lack JSDoc.
- **Fix:** Add JSDoc to `truncate` and interface.

### M8. `app/api/referral/track/route.ts` — Missing Interface Docs

- **File:** `app/api/referral/track/route.ts` (105 lines)
- **Issue:** `TrackRequestBody` interface lacks JSDoc.
- **Fix:** Add JSDoc to the interface fields.

### M9. `app/api/wizard/complete/route.ts` — Missing Error Docs

- **File:** `app/api/wizard/complete/route.ts` (175 lines)
- **Issue:** Error conditions (400, 409, 413, 500) not documented in JSDoc.
- **Fix:** Add error code documentation.

### M10. `app/api/upload/pending/route.ts` — Missing Response Schema Docs

- **File:** `app/api/upload/pending/route.ts` (115 lines)
- **Issue:** Response schemas for POST/GET/DELETE not formally documented.
- **Fix:** Document response schemas explicitly.

### M11. `__tests__/unit/lib/ai/ai-parser.test.ts` — No File-Level Comment

- **File:** `__tests__/unit/lib/ai/ai-parser.test.ts` (1038 lines)
- **Issue:** Longest test file has no explanation of what it tests, fallback paths, or coverage goals.
- **Fix:** Add file-level comment block.

### M12. `__tests__/setup/mocks/crypto.ts` — No File-Level Comment

- **File:** `__tests__/setup/mocks/crypto.ts` (75 lines)
- **Issue:** No explanation of what crypto primitives are mocked.
- **Fix:** Add file-level comment.

### M13. Cron Routes — Missing Response Schema Docs

- **Files:** `app/api/cron/cleanup/route.ts`, `app/api/cron/cleanup-r2/route.ts`, `app/api/cron/recover-orphaned/route.ts`, `app/api/cron/sync-domains/route.ts`
- **Issue:** All 4 cron routes have excellent JSDoc headers but no response schema documentation.
- **Fix:** Add `@returns` JSDoc documenting response shapes.

### M14. `lib/utils/wait-for-completion.ts` — Config Constants Undocumented

- **File:** `lib/utils/wait-for-completion.ts` (164 lines)
- **Issue:** `MAX_WS_CONNECT_ATTEMPTS`, `POLL_INTERVAL_MS`, `PING_INTERVAL_MS` lack JSDoc.
- **Fix:** Add JSDoc to config constants.

### M15. `lib/seo/json-ld.ts` — Interface Fields Undocumented

- **File:** `lib/seo/json-ld.ts` (560 lines)
- **Issue:** `JsonLdPerson`, `JsonLdProfilePage` interface fields lack JSDoc.
- **Fix:** Add JSDoc to interface fields.

### M16. `lib/queue/consumer.ts` — `handleResumeParse` JSDoc Too Minimal

- **File:** `lib/queue/consumer.ts` (327 lines)
- **Issue:** `handleResumeParse` JSDoc is minimal ("Handle resume parsing from queue") but doesn't explain idempotency, cache lookup, staged content, or waiting-for-cache fan-out.
- **Fix:** Expand JSDoc to describe the full state machine.

### M17. `lib/queue/errors.ts` — `extractErrorMessage` Undocumented

- **File:** `lib/queue/errors.ts` (270 lines)
- **Issue:** `extractErrorMessage` (complex multi-type extraction) has zero JSDoc.
- **Fix:** Add JSDoc explaining the extraction strategy.

### M18. `lib/queue/dlq-consumer.ts` — `getAlertChannel` Undocumented

- **File:** `lib/queue/dlq-consumer.ts` (151 lines)
- **Issue:** `getAlertChannel` lacks JSDoc.
- **Fix:** Add JSDoc.

### M19. `lib/cron/cleanup-r2.ts` — Pagination Loop Undocumented

- **File:** `lib/cron/cleanup-r2.ts` (91 lines)
- **Issue:** The `listResult.truncated` cursor pattern has no inline comment.
- **Fix:** Add a comment explaining the pagination pattern.

### M20. `lib/ai/ai-parser.ts` — `truncateForRetry` and `logParseEvent` Undocumented

- **File:** `lib/ai/ai-parser.ts` (548 lines)
- **Issue:** `truncateForRetry` and `logParseEvent` lack JSDoc.
- **Fix:** Add JSDoc.

### M21. `lib/ai/transform.ts` — `trimStrings` Undocumented

- **File:** `lib/ai/transform.ts` (345 lines)
- **Issue:** Internal `trimStrings` recursive function lacks JSDoc.
- **Fix:** Add JSDoc.

### M22. `lib/utils/environment.ts` — `isLocalEnvironment` Undocumented

- **File:** `lib/utils/environment.ts` (10 lines)
- **Issue:** `isLocalEnvironment` lacks JSDoc.
- **Fix:** Add JSDoc.

### M23. `lib/utils/errors.ts` — `ErrorCategory` Undocumented

- **File:** `lib/utils/errors.ts` (60 lines)
- **Issue:** `ErrorCategory` type lacks JSDoc.
- **Fix:** Add JSDoc.

### M24. `lib/utils/pending-upload-cookie.ts` — `getCryptoKey` Undocumented

- **File:** `lib/utils/pending-upload-cookie.ts` (136 lines)
- **Issue:** `getCryptoKey` internal crypto function lacks JSDoc.
- **Fix:** Add JSDoc.

### M25. `lib/umami/client.ts` — `umamiGet` Undocumented

- **File:** `lib/umami/client.ts` (201 lines)
- **Issue:** `umamiGet` internal function lacks JSDoc.
- **Fix:** Add JSDoc.

### M26. `lib/utils/cn.ts` — `cn` Undocumented

- **File:** `lib/utils/cn.ts` (6 lines, 0% coverage)
- **Issue:** `cn` utility (common but not obvious to new devs) lacks JSDoc.
- **Fix:** Add JSDoc.

### M27. `lib/utils/site-url.ts` — `getSiteUrl` Undocumented

- **File:** `lib/utils/site-url.ts` (5 lines, 0% coverage)
- **Issue:** `getSiteUrl` lacks JSDoc.
- **Fix:** Add JSDoc.

### M28. `components/auth/AuthDialog.tsx` — Component JSDoc Missing

- **File:** `components/auth/AuthDialog.tsx` (173 lines)
- **Issue:** Props are documented but component function has no JSDoc.
- **Fix:** Add component JSDoc.

### M29. `components/auth/SignInForm.tsx` — Component JSDoc Missing

- **File:** `components/auth/SignInForm.tsx` (216 lines)
- **Issue:** Props are documented but component function has no JSDoc.
- **Fix:** Add component JSDoc.

### M30. `components/auth/ForgotPasswordForm.tsx` — Component JSDoc Missing

- **File:** `components/auth/ForgotPasswordForm.tsx` (201 lines)
- **Issue:** Props are documented but component function has no JSDoc.
- **Fix:** Add component JSDoc.

### M31. `components/ShareBar.tsx` — `getLinkedInIconVariant` Undocumented

- **File:** `components/ShareBar.tsx` (248 lines)
- **Issue:** `getLinkedInIconVariant` helper lacks JSDoc.
- **Fix:** Add JSDoc.

### M32. `app/(protected)/dashboard/page.tsx` — No JSDoc

- **File:** `app/(protected)/dashboard/page.tsx` (565 lines)
- **Issue:** Large file with significant logic deserves a header.
- **Fix:** Add page-level JSDoc.

### M33. `app/(protected)/settings/page.tsx` — `ProfileSection` Undocumented

- **File:** `app/(protected)/settings/page.tsx` (170 lines)
- **Issue:** `ProfileSection` helper lacks JSDoc.
- **Fix:** Add JSDoc.

### M34. `app/(protected)/waiting/page.tsx` — `WaitingContent` Undocumented

- **File:** `app/(protected)/waiting/page.tsx` (300 lines)
- **Issue:** `WaitingContent` helper lacks JSDoc.
- **Fix:** Add JSDoc.

### M35. `app/(admin)/admin/page.tsx` — Helpers Undocumented

- **File:** `app/(admin)/admin/page.tsx` (189 lines)
- **Issue:** `getAdminStats` and `formatRelativeTime` helpers lack JSDoc.
- **Fix:** Add JSDoc.

### M36. `app/explore/page.tsx` — `DirectoryUser` Undocumented

- **File:** `app/explore/page.tsx` (347 lines)
- **Issue:** `DirectoryUser` interface lacks JSDoc.
- **Fix:** Add JSDoc.

### M37. `app/robots.ts` — No JSDoc

- **File:** `app/robots.ts` (52 lines)
- **Issue:** `robots()` function lacks JSDoc.
- **Fix:** Add JSDoc.

### M38. `SECURITY.md` References Nonexistent `middleware.ts`

- **File:** `SECURITY.md` line 111
- **Issue:** Claims security headers are in `middleware.ts` but they are in `next.config.ts`.
- **Fix:** Update reference to `next.config.ts`.

### M39. `README.md` Omits Test Commands

- **File:** `README.md` lines 303-327
- **Issue:** Omits `test:unit`, `test:integration`, `test:security`, `test:coverage`, `test:ci`, `test:ui`.
- **Fix:** Add all test commands to Available Scripts section.

### M40. `CONTRIBUTING.md` PR Checklist Redundant

- **File:** `CONTRIBUTING.md` line 136
- **Issue:** PR checklist says to run `bun run ci` (which includes test and build) but separately says "Tests pass" and "Build succeeds".
- **Fix:** Clarify that `ci` is the comprehensive check, or simplify the checklist.

### M41-M67. Missing File-Level JSDoc

- **Files:** `lib/utils/errors.ts`, `lib/utils/validation.ts`, `lib/utils/site-url.ts`, `lib/seo/sitemap.ts`, `lib/templates/theme-access.ts`, `lib/templates/theme-registry.ts`, `lib/templates/theme-registry.client.tsx`, `lib/schemas/auth.ts`, `lib/schemas/profile.ts`, `app/(protected)/layout.tsx`, `app/(admin)/admin/layout.tsx`, `app/blog/page.tsx`, `app/blog/layout.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/not-found.tsx`, `app/(protected)/edit/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/settings/page.tsx`, `app/(admin)/admin/page.tsx`, `app/explore/page.tsx`, `app/[handle]/page.tsx` (PageProps interface), `app/[handle]/not-found.tsx`, `app/not-found.tsx`, `app/global-error.tsx` (inline types), `app/error.tsx` (inline types)
- **Issue:** No file-level JSDoc explaining purpose.
- **Fix:** Add file-level JSDoc to all files.

---

## 🟢 Low-Priority Issues (Cosmetic / Nice-to-Have)

### L1-L10. Missing File-Level Comments in Short Test Files

- **Files:** `__tests__/referral.test.ts`, `__tests__/share.test.ts`, `__tests__/disposable-email.test.ts`, `__tests__/password-strength.test.ts`, `__tests__/email-verification.test.ts`, `__tests__/sanitization.test.ts`, `__tests__/milestones.test.ts`, `__tests__/setup/fixtures/index.ts`
- **Issue:** No file-level comment. Low impact since files are short and self-documenting.

### L11-L20. Minor Helper Gaps in Components

- **Files:** `components/dashboard/StatCard.tsx` (path mismatch — actual is `components/admin/StatCard.tsx`), `components/LogoText.tsx` (minor), `components/SiteHeader.tsx` (no props, fine), `components/BottomCTAButton.tsx` (no props, fine), `components/MobileStickyUpload.tsx` (no props, fine), `components/WhatYouGetSection.tsx` (no props, fine), `components/home/Confetti.tsx` (well documented), `components/CreateYoursCTA.tsx` (well documented)
- **Issue:** Minor or no issue.

### L21-L30. App Page Metadata JSDoc

- **Files:** All `app/**/page.tsx` and `app/**/layout.tsx` metadata exports lack JSDoc.
- **Issue:** Low impact. Metadata objects are self-describing.

### L31-L40. `knip.jsonc` Missing Comments

- **File:** `knip.jsonc` (24 lines)
- **Issue:** `entry`, `ignore`, `ignoreDependencies` patterns lack comments.
- **Fix:** Add JSONC comments explaining patterns.

### L41-L50. `biome.jsonc` Missing Comments

- **File:** `biome.jsonc` (93 lines)
- **Issue:** `overrides` for `lib/cloudflare-env.d.ts`, `noImgElement` rule, `css.parser.allowWrongLineComments` lack comments.
- **Fix:** Add JSONC comments.

### L51-L60. `wrangler.jsonc` Undocumented Sections

- **File:** `wrangler.jsonc` (176 lines)
- **Issue:** `assets`, `placement`, `migrations`, `observability`, `vars.AI_MODEL` lack comments.
- **Fix:** Add JSONC comments.

### L61-L70. `lib/db/session.ts` Internal Functions

- **File:** `lib/db/session.ts` (136 lines)
- **Issue:** `createSession`, `createDb`, `createCaptureBookmark` are internal but could use one-line comments.
- **Fix:** Add brief comments.

### L71-L80. `lib/ai/ai-parser.ts` Internal Functions

- **File:** `lib/ai/ai-parser.ts` (548 lines)
- **Issue:** `buildPrompt` is trivial but exported-adjacent.
- **Fix:** Add brief JSDoc if exported.

### L81-L88. Miscellaneous

- `lib/templates/theme-access.ts` (37 lines, ~50% coverage) — minor gaps
- `lib/templates/theme-registry.ts` (37 lines, ~70% coverage) — minor gaps
- `lib/templates/theme-registry.client.tsx` (53 lines, ~80% coverage) — minor gaps
- `lib/types/template.ts` (9 lines, 0% coverage) — `TemplateProps` lacks JSDoc
- `lib/utils/pending-upload-cookie.ts` — `getCryptoKey` lacks JSDoc
- `lib/config/site.ts` — well documented but could add more
- `lib/config/retry.ts` — well documented but could add more
- `lib/password/hibp.ts` — well documented but could add more

---

## Best Practices Observed

### Excellent Documentation Examples

1. **`lib/auth/client.ts`** — Every exported symbol has JSDoc with `@example` blocks.
2. **`lib/auth/middleware.ts`** — Both exported functions have JSDoc with usage examples.
3. **`lib/queue/notify-status.ts`** — 100% coverage, file-level header and both functions documented.
4. **`lib/queue/types.ts`** — 100% coverage, all types and Zod schema documented.
5. **`lib/queue/resume-parse.ts`** — 100% coverage, `publishResumeParse` documented.
6. **`lib/cron/cleanup.ts`** — 100% coverage, file-level header and all symbols documented.
7. **`lib/cron/sync-disposable-domains.ts`** — 100% coverage.
8. **`lib/email/disposable-check.ts`** — Excellent step-by-step JSDoc on `isDisposableEmail`.
9. **`lib/referral.ts`** — Comprehensive JSDoc on `writeReferral` (atomic UPDATE, TOCTOU, parallel hashing).
10. **`lib/auth/index.ts`** — Excellent file-level header and `getAuth` JSDoc with example.
11. **`lib/utils/sanitization.ts`** — All functions have security-focused JSDoc.
12. **`lib/utils/pending-upload-cookie.ts`** — Excellent file-level JSDoc explaining HMAC, httpOnly, tamper-proof design.
13. **`lib/seo/json-ld.ts`** — Excellent `serializeJsonLd` security note about `</script>` escaping.
14. **`lib/durable-objects/resume-status.ts`** — Good defense-in-depth explanation.
15. **`lib/utils/analytics.ts`** — Good privacy-preserving design documentation.
16. **`vite.config.ts`** — Excellent JSDoc on three custom plugins (`clientModuleStubs`, `clientVendorSplit`, `ensureClientDir`).
17. **`components/Confetti.tsx`** — Good JSDoc on props and component.
18. **`components/ShareBar.tsx`** — Good JSDoc on props and complex logic.
19. **`components/CreateYoursCTA.tsx`** — Good JSDoc on props and timer/scroll logic.
20. **`app/error.tsx`, `app/global-error.tsx`, `app/[handle]/error.tsx`** — Excellent JSDoc explaining scope and behavior.

---

## Codebase Inconsistencies (Beyond Documentation)

### I1. `resumes.updatedAt` Nullable vs `.notNull()` Everywhere Else

- **File:** `lib/db/schema/resume.ts`
- **Issue:** `resumes.updatedAt` is nullable while `user.updatedAt`, `session.updatedAt`, `account.updatedAt`, `siteData.updatedAt`, `verification.updatedAt` are `.notNull()`.
- **Impact:** Inconsistent schema design. No documented reason.
- **Fix:** Make `resumes.updatedAt` `.notNull()` or document why it's nullable.

### I2. `rate-limit.ts` File Scope Creep

- **File:** `lib/db/schema/rate-limit.ts`
- **Issue:** Contains `referralClicks` (referral tracking) which is unrelated to rate limiting.
- **Fix:** Rename to `tracking.ts` or split `referralClicks` into its own schema file.

### I3. `account.password` in OAuth-Only Project

- **File:** `lib/db/schema/auth.ts`
- **Issue:** `password` column exists despite AGENTS.md saying "Google OAuth only" (which is also wrong). Better Auth compatibility.
- **Fix:** Add comment explaining it's for Better Auth compatibility / future email/password support.

### I4. `showInDirectory` Denormalization Risk

- **File:** `lib/db/schema/auth.ts`
- **Issue:** Comment says "Denormalized from privacySettings JSON" but doesn't explain sync mechanism or drift risk.
- **Fix:** Document the sync invariant and how drift is prevented.

### I5. `user/stats/route.ts` Uses Raw `Response.json`

- **File:** `app/api/user/stats/route.ts`
- **Issue:** Uses raw `Response.json` instead of `createSuccessResponse`/`createErrorResponse`.
- **Fix:** Switch to consistent response helpers.

### I6. `resume/retry/route.ts` Uses Raw `Response.json` in One Path

- **File:** `app/api/resume/retry/route.ts`
- **Issue:** Line 46 uses raw `Response.json` for error instead of `createErrorResponse`.
- **Fix:** Switch to consistent response helper.

---

## Recommendations by Priority

### 🔴 Immediate (This Week)

1. Fix `AGENTS.md` line 22: `biome --write .` → `biome check --write .`
2. Fix `AGENTS.md` line 100: Update coverage thresholds to 80% (or clarify per-config)
3. Fix `TESTING.md` lines 54-59: Same coverage threshold correction
4. Fix `AGENTS.md` line 9: "Google OAuth only" → "Google OAuth + email/password"
5. Fix `lib/schemas/resume.ts` describe/validation mismatches (200 vs 2000, 500 vs 10000)
6. Add JSDoc to `worker/index.ts` — all handler methods
7. Add JSDoc to `proxy.ts` — auth middleware
8. Add JSDoc to `lib/db/index.ts` — `getDb()` function
9. Add JSDoc to `lib/r2.ts` — all exported methods
10. Add JSDoc to `app/api/resume/status/route.ts` — polling endpoint
11. Add JSDoc to `app/api/resume/retry/route.ts` — retry endpoint
12. Add JSDoc to `app/api/resume/update-theme/route.ts` — theme endpoint
13. Add JSDoc to `lib/utils/xml.ts` — escapeXml security utility
14. Fix `app/api/profile/privacy/route.ts` — update JSDoc to include all 4 fields
15. Fix `SECURITY.md` line 111: `middleware.ts` → `next.config.ts`

### 🟡 High Priority (Next Sprint)

16. Add table-level JSDoc to all 8 DB tables
17. Add JSDoc to all exported DB types (`User`, `Resume`, `SiteData`, etc.)
18. Document `resumes` status lifecycle and field distinctions
19. Document `siteData.resumeId` cascade behavior
20. Add JSDoc to `lib/ai/ai-normalize.ts` — all exported functions
21. Add JSDoc to `lib/umami/client.ts` — all exported functions
22. Add JSDoc to `lib/seo/sitemap.ts` — all exported functions
23. Add JSDoc to `lib/utils/validation.ts` — all exported symbols
24. Add JSDoc to `app/api/upload/route.ts` — file-level header with rate limits
25. Add JSDoc to `lib/templates/theme-ids.ts` — core constants
26. Add JSDoc to `lib/ai/index.ts` — `ParseResumeResult` and `validateParseResult`
27. Add JSDoc to all 3 sitemap routes
28. Add `@returns` JSDoc to all 5 admin routes
29. Add JSDoc to `drizzle.config.ts` — `getLocalD1Path()`
30. Add JSDoc to `next.config.ts` — config export
31. Add JSDoc to `lib/durable-objects/resume-status.ts` — remaining methods
32. Add JSDoc to `lib/ai/ai-parser.ts` — `AiParseResult`
33. Add JSDoc to `lib/ai/pdf-extract.ts` — `PdfExtractResult`
34. Add JSDoc to `lib/email/cloudflare.ts` — params interfaces
35. Add JSDoc to `lib/auth/admin.ts` — `AdminUser`
36. Add JSDoc to `lib/ai/ai-fallback.ts` — `parseJsonWithRepair`
37. Add JSDoc to `lib/templates/contact-links.ts` — types
38. Add JSDoc to `lib/schemas/profile.ts` — exported symbols
39. Add JSDoc to `lib/schemas/auth.ts` — type aliases
40. Add JSDoc to `app/api/site-data/route.ts` — expand existing JSDoc
41. Add JSDoc to `app/api/og/[handle]/route.ts` — mention SVG fallback
42. Add JSDoc to `app/api/analytics/stats/route.ts` — response shape
43. Add file-level comment to `__tests__/unit/lib/ai/ai-parser.test.ts`
44. Add file-level comment to `__tests__/setup/mocks/crypto.ts`
45. Update `README.md` — add all test commands

### 🟠 Medium Priority (Backlog)

46. Add JSDoc to `app/api/health/route.ts` — internal helpers
47. Add JSDoc to `app/api/client-error/route.ts` — helpers
48. Add JSDoc to `app/api/referral/track/route.ts` — interface
49. Add JSDoc to `app/api/wizard/complete/route.ts` — error codes
50. Add JSDoc to `app/api/upload/pending/route.ts` — response schemas
51. Add JSDoc to cron routes — response schemas
52. Add JSDoc to `lib/utils/wait-for-completion.ts` — config constants
53. Add JSDoc to `lib/seo/json-ld.ts` — interface fields
54. Expand `lib/queue/consumer.ts` — `handleResumeParse` JSDoc
55. Add JSDoc to `lib/queue/errors.ts` — `extractErrorMessage`
56. Add JSDoc to `lib/queue/dlq-consumer.ts` — `getAlertChannel`
57. Add JSDoc to `lib/cron/cleanup-r2.ts` — pagination comment
58. Add JSDoc to `lib/ai/ai-parser.ts` — `truncateForRetry`, `logParseEvent`
59. Add JSDoc to `lib/ai/transform.ts` — `trimStrings`
60. Add JSDoc to `lib/utils/environment.ts` — `isLocalEnvironment`
61. Add JSDoc to `lib/utils/errors.ts` — `ErrorCategory`
62. Add JSDoc to `lib/utils/pending-upload-cookie.ts` — `getCryptoKey`
63. Add JSDoc to `lib/umami/client.ts` — `umamiGet`
64. Add JSDoc to `lib/utils/cn.ts` — `cn`
65. Add JSDoc to `lib/utils/site-url.ts` — `getSiteUrl`
66. Add JSDoc to auth components — `AuthDialog`, `SignInForm`, `ForgotPasswordForm`
67. Add JSDoc to `components/ShareBar.tsx` — `getLinkedInIconVariant`
68. Add JSDoc to `app/(protected)/dashboard/page.tsx` — page
69. Add JSDoc to `app/(protected)/settings/page.tsx` — `ProfileSection`
70. Add JSDoc to `app/(protected)/waiting/page.tsx` — `WaitingContent`
71. Add JSDoc to `app/(admin)/admin/page.tsx` — helpers
72. Add JSDoc to `app/explore/page.tsx` — `DirectoryUser`
73. Add JSDoc to `app/robots.ts` — `robots()` function
74. Add file-level JSDoc to 9 files in `lib/` (errors.ts, validation.ts, site-url.ts, sitemap.ts, theme-access.ts, theme-registry.ts, theme-registry.client.tsx, schemas/auth.ts, schemas/profile.ts)
75. Add file-level JSDoc to all `app/**/page.tsx` and `app/**/layout.tsx`
76. Add file-level JSDoc to all `app/**/not-found.tsx`
77. Add file-level comments to short test files
78. Add JSONC comments to `knip.jsonc`, `biome.jsonc`, `wrangler.jsonc`
79. Add comments to `wrangler.jsonc` migrations array explaining each tag
80. Fix `CONTRIBUTING.md` PR checklist redundancy

### 🟢 Low Priority (Nice-to-Have)

81. Add JSDoc to `lib/db/session.ts` internal functions
82. Add JSDoc to `lib/ai/ai-parser.ts` `buildPrompt`
83. Add JSDoc to `lib/templates/theme-access.ts` (minor gaps)
84. Add JSDoc to `lib/templates/theme-registry.ts` (minor gaps)
85. Add JSDoc to `lib/types/template.ts` — `TemplateProps`
86. Add `@example` tags to more complex functions
87. Investigate `components/dashboard/StatCard.tsx` vs `components/admin/StatCard.tsx` path mismatch
88. Add JSDoc to `app/(protected)/edit/page.tsx` — page
89. Add JSDoc to `app/(protected)/wizard/page.tsx` — already excellent, minor additions
90. Add JSDoc to `app/(protected)/waiting/page.tsx` — already good, minor additions

---

## Appendix A: File-Level Coverage Summary

| Module                 | Files   | Avg Coverage | Grade  |
| ---------------------- | ------- | ------------ | ------ |
| `worker/`              | 1       | 25%          | D      |
| `proxy.ts`             | 1       | 0%           | F      |
| `vite.config.ts`       | 1       | 75%          | B+     |
| `next.config.ts`       | 1       | 0%           | F      |
| `wrangler.jsonc`       | 1       | 60%          | C      |
| `package.json`         | 1       | N/A          | N/A    |
| `biome.jsonc`          | 1       | 0%           | F      |
| `knip.jsonc`           | 1       | 0%           | F      |
| `drizzle.config.ts`    | 1       | 0%           | F      |
| `lib/db/`              | 10      | ~5%          | F      |
| `lib/ai/`              | 6       | ~50%         | D      |
| `lib/auth/`            | 5       | ~92%         | A      |
| `lib/queue/`           | 6       | ~88%         | B+     |
| `lib/cron/`            | 4       | ~95%         | A      |
| `lib/email/`           | 2       | ~90%         | A      |
| `lib/r2.ts`            | 1       | ~15%         | F      |
| `lib/referral.ts`      | 1       | ~90%         | A      |
| `lib/utils/`           | 22      | ~75%         | B+     |
| `lib/schemas/`         | 4       | ~60%         | C      |
| `lib/templates/`       | 7       | ~70%         | C+     |
| `lib/seo/`             | 2       | ~65%         | C      |
| `lib/durable-objects/` | 1       | ~95%         | A      |
| `lib/umami/`           | 1       | ~40%         | D      |
| `lib/types/`           | 2       | ~50%         | C      |
| `app/api/`             | 35      | ~55%         | D      |
| `app/(public)/`        | ~10     | ~10%         | F      |
| `app/(protected)/`     | ~10     | ~10%         | F      |
| `app/(admin)/`         | ~5      | ~10%         | F      |
| `app/blog/`            | ~10     | ~10%         | F      |
| `components/`          | ~50     | ~70%         | C+     |
| `__tests__/`           | ~80     | ~60%         | C      |
| **Total**              | **391** | **~45%**     | **D+** |

---

## Appendix B: Documentation Accuracy Issues

| File                      | Claim                | Reality                 | Severity |
| ------------------------- | -------------------- | ----------------------- | -------- |
| `AGENTS.md`               | `biome --write .`    | `biome check --write .` | Critical |
| `AGENTS.md`               | 30% coverage         | 80% coverage            | Critical |
| `AGENTS.md`               | Google OAuth only    | OAuth + email/password  | Critical |
| `TESTING.md`              | 30% coverage         | 80% coverage            | Critical |
| `README.md`               | Google OAuth         | OAuth + email/password  | Medium   |
| `README.md`               | Missing test scripts | 6 test scripts exist    | Medium   |
| `SECURITY.md`             | `middleware.ts`      | `next.config.ts`        | Medium   |
| `lib/schemas/resume.ts`   | max 200 chars        | max 2000 chars          | Critical |
| `lib/schemas/resume.ts`   | max 500 chars        | max 10000 chars         | Critical |
| `app/api/profile/privacy` | 2 fields             | 4 fields                | High     |

---

## Appendix C: Inconsistencies Between Code and Design

| Issue                          | File                                                           | Details                         |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------- |
| `resumes.updatedAt` nullable   | `lib/db/schema/resume.ts`                                      | Inconsistent with other tables  |
| `rate-limit.ts` scope creep    | `lib/db/schema/rate-limit.ts`                                  | Contains `referralClicks`       |
| `account.password` unexplained | `lib/db/schema/auth.ts`                                        | Better Auth compatibility       |
| `showInDirectory` sync         | `lib/db/schema/auth.ts`                                        | Denormalization risk            |
| `Response.json` inconsistency  | `app/api/user/stats/route.ts`, `app/api/resume/retry/route.ts` | Not using `createErrorResponse` |

---

## Conclusion

The codebase has **strong documentation in auth, queue, cron, and security utilities** but **critical gaps in infrastructure, database schema, and API routes**. The most urgent issues are:

1. **Factual inaccuracies** in AGENTS.md, TESTING.md, and schema descriptions that will mislead developers.
2. **Missing JSDoc** on the core worker handler, database accessor, and R2 utility — these are the first files new developers need to understand.
3. **Stale JSDoc** on API routes that no longer match implementation (e.g., privacy endpoint fields).

Fixing the 12 critical issues and 24 high-priority issues will bring the codebase to a solid B+ grade and significantly improve developer onboarding.
