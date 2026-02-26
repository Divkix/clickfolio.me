# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Module-level state in disposable email checker:**
- Issue: `lib/email/disposable-check.ts` uses module-level cache (`cachedDomains`, `cacheTimestamp`) that persists across Worker isolates
- Files: `lib/email/disposable-check.ts` (lines 90-102)
- Impact: In long-lived Worker contexts, stale domain list could persist beyond 1-hour TTL if isolate doesn't recycle; reduces effectiveness of disposable email blocking
- Fix approach: Consider switching to KV-only caching without module-level cache, or add explicit cache invalidation trigger

**Oversized page components:**
- Issue: Multiple page components exceed 500 lines and mix UI, data fetching, and business logic
- Files: `app/(protected)/wizard/page.tsx` (580 lines), `app/(protected)/dashboard/page.tsx` (564 lines), `app/privacy/page.tsx` (574 lines), `app/(protected)/waiting/page.tsx` (298 lines)
- Impact: Difficult to test, refactor, and understand control flow; makes future feature additions harder
- Fix approach: Extract form handling, polling logic, and state management into custom hooks; break into smaller sub-components

**Race condition in handle updates:**
- Issue: Handle change check (lines 112-116 in `app/api/profile/handle/route.ts`) followed by batch update (lines 130-145) creates window for collision
- Files: `app/api/profile/handle/route.ts` (lines 112-124)
- Impact: Two concurrent requests with same new handle could both pass availability check and both attempt update; caught by UNIQUE constraint but user sees error
- Fix approach: Use database-level lock or move availability check into transaction; alternatively, catch and retry with exponential backoff

**Middleware auth is shallow:**
- Issue: Middleware in `middleware.ts` only checks session cookie existence, not validity
- Files: `middleware.ts` (lines 19-26)
- Impact: User with expired/forged session cookie passes middleware but fails in page components; creates inconsistent UX
- Fix approach: This is intentional per CLAUDE.md (edge middleware can't call D1), but document the risk: attackers can set fake cookies to bypass middleware redirects (caught by downstream auth checks)

## Known Bugs

**siteData cache invalidation incomplete:**
- Symptoms: Privacy setting changes (e.g., hide_phone toggle) update siteData but edge cache at 1hr TTL serves stale content
- Files: `lib/cloudflare-cache-purge.ts`, `app/(protected)/settings/page.tsx`
- Trigger: User changes privacy settings, then refreshes their public portfolio within 1 hour; old phone number still visible
- Workaround: Manual cache purge via CF dashboard, or wait 1 hour
- Severity: Medium (privacy-sensitive)

**waiting_for_cache timeout not resilient:**
- Symptoms: Resume stuck at "processing" after 10 minutes if another duplicate upload's parsing never completes
- Files: `app/api/resume/status/route.ts` (lines 10, 65-87)
- Trigger: Two identical files uploaded concurrently; first enters "processing", second waits for cache; if first parsing fails/hangs, second times out after 10min
- Workaround: User can manually retry upload
- Severity: Low (affects duplicate uploads only)

## Security Considerations

**Email domain blocklist can go stale:**
- Risk: If `disposable-domains` KV value isn't updated regularly, new disposable providers bypass check; users sign up with temp emails
- Files: `lib/email/disposable-check.ts`, `lib/cron/sync-disposable-domains.ts`
- Current mitigation: Cron job syncs daily; email verification is secondary safeguard; fails open (allows signup) on KV errors
- Recommendations:
  1. Add alerting if KV sync fails for >2 days
  2. Consider backup list of top 20-30 most common disposable domains (hardcoded)
  3. Document that email verification is the primary defense, not domain blocklist

**Handle collision allows race condition exploitation:**
- Risk: Attacker with two tabs can claim same handle twice (one succeeds, one fails); confusion if attacker then deletes their account
- Files: `app/api/profile/handle/route.ts` (lines 112-124, 130-145)
- Current mitigation: UNIQUE constraint catches violation; rate limit (3 changes/24h) slows attacks
- Recommendations:
  1. Add database-level constraint to prevent checking and updating in separate statements
  2. Return 429 on collision instead of 409 (signals transient vs permanent error)
  3. Implement exponential backoff retry on client side

**Privacy filter in public resume viewer may be incomplete:**
- Risk: If new contact field added to ResumeContent schema without privacy filter in `[handle]/page.tsx`, users exposed to unfiltered data
- Files: `app/[handle]/page.tsx` (privacy filtering logic not shown in excerpt), `lib/types/database.ts` (ResumeContent schema)
- Current mitigation: Privacy settings hard-coded for specific fields (phone, address, search indexing)
- Recommendations:
  1. Centralize privacy filtering logic in a single utility function
  2. Add schema-level comments marking which fields require privacy filtering
  3. Add unit tests for all privacy filter combinations

**Disposable email check fails open without notification:**
- Risk: If KV is null or errors, system accepts any email including known disposables; email verification catches most but not all
- Files: `lib/email/disposable-check.ts` (lines 127, 143-146)
- Current mitigation: Email verification is the safety net
- Recommendations:
  1. Log "DISPOSABLE_CHECK_FAILED_OPEN" events for monitoring
  2. Add metric to track how often fallback occurs

## Performance Bottlenecks

**Polling every 3 seconds during resume parsing:**
- Problem: Client-side status polling at 3-second intervals creates 20+ requests during 30-40s parse; unnecessary load
- Files: `components/upload/UploadWizardFlow.tsx` (polling interval), `app/api/resume/status/route.ts`
- Cause: WebSocket fallback not always connecting; HTTP fallback is conservative
- Improvement path:
  1. Increase fallback polling to 5-10s after first 30s of WebSocket failures
  2. Add exponential backoff: 3s → 5s → 10s
  3. Reduce requests from ~12-15 per parse to ~4-6

**siteData upserts not batched on first publish:**
- Problem: `POST /api/resume/claim` with cached result does 2 D1 roundtrips (check cache, then batch upsert); creates 10-20ms per claim
- Files: `app/api/resume/claim/route.ts` (lines 197-209, 239-250)
- Cause: Must check for cached result before R2 put, then update after R2 succeeds
- Improvement path: Restructure to query and upsert in single transaction after R2 succeeds

**Weekly schema export not optimized for large resumes:**
- Problem: Sitemap generation fetches all handles + resume metadata; no pagination
- Files: `app/sitemap.ts`, `app/api/sitemap-index/route.ts`
- Cause: D1 has no built-in pagination; query result size grows with user base
- Improvement path:
  1. Add `LIMIT/OFFSET` pagination to sitemap routes
  2. Split into multiple sitemaps (e.g., sitemap-1.xml, sitemap-2.xml, index)
  3. Cache sitemaps in KV with daily refresh

## Fragile Areas

**Resume claim double-submit handling:**
- Files: `app/api/resume/claim/route.ts` (lines 100-117)
- Why fragile: Race condition between file deletion and resume insertion can cause inconsistent state; double-submit from wizard retry creates two DB records
- Safe modification:
  1. Always check for recent resume in 2-minute window before failing
  2. Batch R2 put and DB insert atomically if possible (not possible with Workers)
  3. Test with concurrent requests (use vitest or playwright)
- Test coverage: `__tests__/idor-ownership.test.ts` covers auth checks but not race conditions

**Queue consumer error classification:**
- Files: `lib/queue/errors.ts`, `lib/queue/consumer.ts` (lines 289-299), `worker.ts` (lines 88-99)
- Why fragile: Error classification regex patterns could fail to match new error messages from updated AI providers or unpdf
- Safe modification:
  1. Add unit tests for each error type (password protected, corrupt, timeout, etc.)
  2. Use error message whitelist instead of regex blacklist
  3. Log raw error before classification for debugging
- Test coverage: Gaps in testing error classification edge cases

**WebSocket connection fallback logic:**
- Files: `hooks/useResumeWebSocket.ts` (lines 30-144), `lib/utils/wait-for-completion.ts` (lines 14-149)
- Why fragile: WebSocket and HTTP polling run in parallel; both could report completion at same time; race condition possible in state updates
- Safe modification:
  1. Use single source of truth (either WS or HTTP, not both)
  2. If WS succeeds, abort HTTP polling immediately
  3. Add comprehensive logging of WS state transitions
- Test coverage: No tests for concurrent WS+HTTP completion

**Admin dashboard assumes infinite scaling:**
- Files: `app/(admin)/admin/referrals/page.tsx` (314 lines), `app/(admin)/admin/resumes/page.tsx` (303 lines), `app/(admin)/admin/users/page.tsx` (207 lines)
- Why fragile: Fetches all referrals/resumes/users without pagination; will time out at ~10k users
- Safe modification:
  1. Add server-side pagination (cursor-based or offset)
  2. Add pagination UI (prev/next buttons, page size selector)
  3. Add query limit validation (max 100 per page)
- Test coverage: No load tests with realistic user counts

## Scaling Limits

**D1 database connections:**
- Current capacity: Single D1 with 100 concurrent connections (CF limit)
- Limit: High traffic spikes during referral campaigns could exhaust pool; seen ~50 concurrent at peak
- Scaling path:
  1. Monitor connection count via wrangler d1 metrics
  2. Implement read replicas via D1 replication (enterprise only)
  3. Add connection pooling middleware (not available on Workers)

**R2 storage has no quota enforcement:**
- Current capacity: Unlimited per bucket
- Limit: Malicious actor uploading 1000x 5MB PDFs (5GB) would consume storage; no per-user quota
- Scaling path:
  1. Add uploadRateLimits per-user (currently IP-based only)
  2. Implement R2 lifecycle rules to expire temp/ keys after 7 days
  3. Add user-level storage quota check before upload

**Email sending via Resend:**
- Current capacity: 3k/month free tier
- Limit: Hits ceiling if user base >1k (1 email per signup + password resets)
- Scaling path:
  1. Migrate to AWS SES (cheaper at scale, $0.10/1k)
  2. Batch verify emails (send once per day instead of immediately)
  3. Implement progressive onboarding (email verification not required for first resume)

**Referral tracking JOIN queries on large datasets:**
- Current capacity: Works fine up to 100k referral clicks
- Limit: At 1M+ clicks, JOIN between referralClicks + user causes full table scans
- Scaling path:
  1. Add composite index on (referrerUserId, converted, convertedUserId)
  2. Denormalize convertedUserEmail on referralClicks to avoid JOIN
  3. Partition referralClicks by referrerUserId (not available in D1)

## Dependencies at Risk

**Better Auth pinned to v1.4.18:**
- Risk: v2 released but requires migration; v1 may receive fewer security patches
- Impact: Session handling, OAuth flow, email verification depend on v1.x API
- Migration plan:
  1. Audit breaking changes in v2 (likely auth.api.* changes)
  2. Update session validation in middleware.ts and requireAuthWithUserValidation
  3. Test OAuth flow with Google on staging
  4. Plan 2-3 sprint effort

**unpdf at v1.4.0 could have parsing regressions:**
- Risk: Scanned PDFs or PDFs with unusual encodings fail extraction
- Impact: 5-10% of PDFs cause "no text extracted" error; user gets parse failure
- Migration plan:
  1. Monitor error logs for "extracted text is empty"
  2. Consider pdfjs-dist as fallback (larger bundle)
  3. Add human review queue for failed extractions (stretch goal)

**Drizzle ORM at v0.45.1 (cutting edge):**
- Risk: Newer than v0.44 LTS; edge features may have bugs
- Impact: batch() queries, relations, migrations could have regressions
- Migration plan:
  1. Pin to v0.44 if edge feature bugs encountered
  2. Monitor GitHub issues for reported bugs with batch()
  3. Test migrations on staging D1 before production applies

**@opennextjs/cloudflare at v1.16.5:**
- Risk: OpenNext is community-maintained, less stable than official Next.js adapters
- Impact: Worker bundling, image optimization, server components could have issues
- Migration plan:
  1. Monitor for release notes of major versions
  2. Test locally with `bun run build:worker` before upgrading
  3. Have rollback plan (previous git tag) if deploy breaks

## Missing Critical Features

**No per-user file storage quota:**
- Problem: Users can upload unlimited files (5MB × ∞) consuming R2 storage
- Blocks: SLA for storage cost; can't offer free tier indefinitely
- Priority: High (blocking monetization)
- Implementation approach: Add `userStorageBytes` to user table; check before upload; cleanup on account delete

**No analytics for failed parses:**
- Problem: Can't identify which resume formats fail most; can't improve AI parser
- Blocks: Feature prioritization; can't validate parser improvements
- Priority: Medium (affects parsing success rate improvement)
- Implementation approach: Log parse failures to structured table; add admin dashboard for failure patterns

**No resume versioning or undo:**
- Problem: Users can overwrite content but can't revert to previous parse
- Blocks: Can't recover from accidental edits
- Priority: Low (workaround: re-upload PDF)
- Implementation approach: Keep parsedContentStaged history; add "restore" button

**No audit trail for user actions:**
- Problem: Can't detect abuse (e.g., handle squatting, referral fraud)
- Blocks: Fraud detection; compliance auditing
- Priority: Medium (blocks premium monetization)
- Implementation approach: Add auditLog table (userId, action, timestamp, ipAddress); log: signin, profile changes, handle changes

## Test Coverage Gaps

**Resume claim idempotency:**
- What's not tested: Double-submit with same file; concurrent claims; race conditions with cache
- Files: `app/api/resume/claim/route.ts`, `__tests__/resume-claim.test.ts` (if exists)
- Risk: Undetected race conditions could create duplicate resumes or orphaned siteData
- Priority: High (core feature)

**Privacy filter completeness:**
- What's not tested: All combinations of privacy settings; newly added fields; edge cases (null values, empty strings)
- Files: `app/[handle]/page.tsx`, `lib/utils/privacy-filter.ts` (if exists)
- Risk: User data leaks (phone, email) on public resume
- Priority: Critical (security)

**Error classification in queue consumer:**
- What's not tested: Each error type (timeout, corrupt, encrypted, empty); retry vs permanent decisions
- Files: `lib/queue/errors.ts`, `lib/queue/consumer.ts`
- Risk: Retryable errors marked permanent (wasted user time); permanent errors retried endlessly (worker cost)
- Priority: High (impacts cost and UX)

**WebSocket fallback scenarios:**
- What's not tested: WebSocket connection failures; network flakiness; concurrent WS+HTTP completion
- Files: `hooks/useResumeWebSocket.ts`, `lib/utils/wait-for-completion.ts`
- Risk: Race condition in status updates; duplicate notifications
- Priority: Medium (affects ~5% of users on slow networks)

**Handle collision under concurrent load:**
- What's not tested: Two users simultaneously claiming same handle; race condition after availability check
- Files: `app/api/profile/handle/route.ts`
- Risk: One user gets confusing error; handle taken unexpectedly
- Priority: Medium (edge case but security-relevant)

**Admin dashboard pagination:**
- What's not tested: Referrals/resumes/users pages with 10k+ records
- Files: `app/(admin)/admin/referrals/page.tsx`, `app/(admin)/admin/resumes/page.tsx`
- Risk: Page times out at scale; admin can't manage large datasets
- Priority: Medium (blocks scaling)

---

*Concerns audit: 2026-02-26*
