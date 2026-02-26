# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Cloudflare Workers + Next.js App Router with async queue-driven resume parsing.

**Key Characteristics:**
- Single Cloudflare Worker handles Next.js routing (via OpenNext), WebSocket upgrades, and async queue consumption
- Claim-check pattern: anonymous file upload before authentication, linked to user account on login
- Event-driven resume parsing: queue consumer processes uploads asynchronously via AI SDK
- Real-time status updates via Durable Objects and WebSocket Hibernation API
- Lightweight edge middleware validates session cookie existence only (full auth deferred to handlers)

## Layers

**Presentation Layer (Frontend):**
- Purpose: Render pages and components, handle user interactions
- Location: `app/`, `components/`
- Contains: Server Components (RSC), client components ("use client"), templates
- Depends on: API routes, auth hooks, database queries (via getServerSession)
- Used by: Browser, analytics tracker

**API & Route Handlers Layer:**
- Purpose: HTTP endpoint implementation, request validation, response formatting
- Location: `app/api/`
- Contains: 34 route handlers (auth, resume, upload, profile, admin, cron, analytics)
- Depends on: Auth, DB, R2, queues, Durable Objects, AI providers
- Used by: Frontend, mobile clients, webhooks, cron triggers

**Business Logic Layer:**
- Purpose: Core application workflows, validation, state transitions
- Location: `lib/auth/`, `lib/queue/`, `lib/referral.ts`, `lib/data/`
- Contains: Session management, queue consumers, error classification, resume pipeline
- Depends on: Database, R2, email service, AI providers
- Used by: Route handlers, queue consumer, scheduled tasks

**Persistence Layer:**
- Purpose: Data storage and retrieval
- Location: `lib/db/schema.ts`, database queries via Drizzle ORM
- Contains: 10 tables (user, session, account, verification, resumes, siteData, handleChanges, uploadRateLimits, referralClicks, KV for disposable domains)
- Depends on: D1 (SQLite), R2 (file storage), Cloudflare KV (domain blocklist)
- Used by: All business logic and route handlers

**Infrastructure Layer:**
- Purpose: Cloudflare bindings and external service integrations
- Location: `worker.ts`, `wrangler.jsonc`, `lib/auth/index.ts`
- Contains: Worker fetch/queue/scheduled handlers, D1 binding setup, R2 wrapper, auth caching
- Depends on: Cloudflare Workers platform, Better Auth, Vercel AI SDK, unpdf
- Used by: All upper layers

## Data Flow

**Resume Upload → Parsing → Publication:**

1. User (unauthenticated) uploads PDF via `POST /api/upload`
   - File stored in R2 with temp UUID key
   - Returns temp key stored in browser localStorage
   - No database entry yet (claim-check pattern)

2. User authenticates (Google OAuth or email/password)
   - Middleware checks session cookie exists
   - Protected page component calls `getServerSession()` for full auth validation

3. User claims upload via `POST /api/resume/claim`
   - Retrieves temp key from frontend state/localStorage
   - Creates resume record with status "pending_claim"
   - Enqueues message to `resume-parse-queue`
   - Returns resumeId for status polling

4. Queue consumer processes message (handled by `worker.ts` queue handler)
   - Validates resume still pending (idempotency check)
   - Fetches PDF from R2 via `getR2Binding(env)`
   - Extracts text with `unpdf` (in-worker, ~20KB gzipped)
   - Sends to AI provider via Vercel AI SDK for structured parsing
   - On success: writes parsed content to `siteData`, updates status to "completed"
   - On retryable error: message.retry() (automatic backoff)
   - On permanent error: message.ack() to route to DLQ (resume-parse-dlq)

5. DLQ consumer handles permanent failures
   - Classifies error (via `classifyQueueError()`)
   - Sets resume.status = "failed", stores user-friendly errorMessage
   - Notifies user via dashboard alert or email

6. Client polls resume status via `GET /api/resume/status?resume_id=X`
   - Returns lightweight columns until completion
   - On completion, fetches full content from `siteData`
   - Alternative: WebSocket connection to `ResumeStatusDO` for real-time push

7. User edits content via `PUT /api/resume/update`
   - Updates `siteData.content` (JSON TEXT), stores edited parsed fields
   - Triggers edge cache purge via `lib/cloudflare-cache-purge.ts`

8. Public views portfolio at `/@handle`
   - Server Component fetches resume metadata from `siteData`
   - Applies privacy filters (phone, address, search visibility)
   - Renders selected template with content
   - Increments analytics via Umami tracker script

**Referral Tracking:**

1. Visitor arrives via referral link (e.g., `?ref=REFERRAL_CODE`)
2. `POST /api/referral/track` logs click with visitor hash (fingerprint)
3. Idempotent deduplication via `UNIQUE(referrerUserId, visitorHash)` index
4. If visitor later signs up, mark click as converted via `POST /api/referral/track` with `convertedUserId`
5. Referral count denormalized on user table for fast sorting in /explore

**State Management:**

- **Session state:** Stored in Better Auth session table, validated via middleware + handlers
- **Resume processing state:** Tracked in `resumes` table (status enum, errorMessage, retry count)
- **Resume content:** Stored as JSON TEXT in `siteData.content` (parsed resume data)
- **Privacy settings:** JSON TEXT in `user.privacySettings`, denormalized `showInDirectory` for indexing
- **Referral state:** Denormalized `user.referralCount`, tracking in `referralClicks` table with idempotent dedup

## Key Abstractions

**Better Auth Session:**
- Purpose: Standardized authentication (Google OAuth, email/password, sessions, verification)
- Examples: `lib/auth/index.ts` (server config), `lib/auth/client.ts` (client hooks), `lib/auth/session.ts` (cached getter)
- Pattern: WeakMap-cached auth instance per D1 binding; D1 proxy wraps Date serialization; session validated in middleware + handlers

**Queue Error Classification:**
- Purpose: Distinguish transient errors (retry) from permanent failures (DLQ)
- Examples: `lib/queue/errors.ts` (enum + pattern matching), `lib/queue/consumer.ts` (applies on catch)
- Pattern: QueueError class with error type + retryability check; 30+ regex patterns for classification

**Resume Status Notification:**
- Purpose: Real-time status updates without polling
- Examples: `lib/durable-objects/resume-status.ts` (DO), `worker.ts` (WebSocket routing), `components/dashboard/RealtimeStatusListener.tsx` (client)
- Pattern: Durable Object keyed by resumeId, accepts WebSocket connections, broadcasts status via POST /notify from queue consumer

**Template Registry:**
- Purpose: Centralized theme metadata + dynamic imports
- Examples: `lib/templates/theme-ids.ts` (metadata, unlock logic), `lib/templates/theme-registry.tsx` (imports)
- Pattern: Enum of theme IDs (underscore), registry with categories + referral unlocks, dynamic require() for code splitting

**Privacy Filter:**
- Purpose: Redact PII based on user settings before rendering public resume
- Examples: `app/[handle]/page.tsx` (applies on server), `lib/utils/privacy-filters.ts` (helpers)
- Pattern: Parse privacySettings JSON, conditionally delete/redact content fields (phone, address, location)

**Rate Limiting:**
- Purpose: Prevent abuse on upload, handle check, email validation
- Examples: `lib/utils/rate-limit.ts` (checks uploadRateLimits table), route handlers call this
- Pattern: IP hash (SHA256 of IP) + action type + time-window; TTL expiry for automatic cleanup

**Referral Deduplication:**
- Purpose: Count unique visitors per referrer, prevent double-counting
- Examples: `referralClicks` table with `UNIQUE(referrerUserId, visitorHash)` index
- Pattern: Visitor fingerprint (hash of IP + user agent), idempotent upsert, mark converted on signup

## Entry Points

**Web Request (Browser):**
- Location: `worker.ts` fetch handler, wraps OpenNext handler
- Triggers: HTTP request from client
- Responsibilities:
  1. Route WebSocket upgrades to ResumeStatusDO
  2. Serve static assets from ASSETS binding
  3. Fall through to OpenNext for Next.js routing

**Next.js App Router:**
- Location: `app/` directory structure
- Entry: `app/layout.tsx` (root RSC), applied to all routes
- Responsibilities:
  1. Load Umami analytics script with self-view filter
  2. Global metadata setup, viewport config
  3. Render Sonner toaster

**Protected Routes:**
- Location: `app/(protected)/layout.tsx`
- Triggers: Navigation to /dashboard, /edit, /settings, /waiting, /wizard
- Responsibilities:
  1. Force dynamic rendering (no static generation)
  2. Validate session via `getServerSession()`
  3. Redirect to home if not authenticated
  4. Wrap children in SidebarLayoutClient

**Public Resume Viewer:**
- Location: `app/[handle]/page.tsx`
- Triggers: Navigation to `/@handle`
- Responsibilities:
  1. Parse handle from URL params, validate format
  2. Fetch resume metadata + content via `getResumeData()`
  3. Apply privacy filters based on user settings
  4. Generate SEO metadata dynamically
  5. Render selected template with content
  6. Track view in Umami

**Queue Consumer:**
- Location: `worker.ts` queue handler
- Triggers: Message enqueued to `resume-parse-queue` or `resume-parse-dlq`
- Responsibilities:
  1. Parse and validate message schema
  2. Call `handleQueueMessage()` for main queue (resume parsing)
  3. Call `handleDLQMessage()` for DLQ (permanent failures)
  4. Classify error on exception, retry or ack to DLQ
  5. Send status notifications to ResumeStatusDO

**Scheduled Tasks (Cron):**
- Location: `worker.ts` scheduled handler
- Triggers: Cron patterns configured in `wrangler.jsonc` (0 3 * * *, 0 4 * * *, */15 * * * *)
- Responsibilities:
  1. `0 3 * * *`: `performCleanup()` — expire old sessions and email verifications
  2. `0 4 * * *`: `syncDisposableDomains()` — update KV blocklist of disposable email domains
  3. `*/15 * * * *`: `recoverOrphanedResumes()` — re-queue uploads stuck in pending_claim

## Error Handling

**Strategy:** Multi-layer error classification and user-friendly messaging.

**Patterns:**

1. **Route Handler Errors:**
   - Try-catch with Zod schema validation
   - Return HTTP error response with error.message
   - Examples: `app/api/resume/claim/route.ts`, `app/api/upload/route.ts`

2. **Queue Processing Errors:**
   - Classification via `classifyQueueError()` (pattern matching on error message)
   - Retryable errors (DB timeout, AI provider down, R2 throttle): `message.retry()`
   - Permanent errors (invalid PDF, malformed JSON, file not found): `message.ack()` to DLQ
   - Examples: `lib/queue/consumer.ts`, `lib/queue/dlq-consumer.ts`

3. **User-Facing Error Messages:**
   - Queue consumer maps raw errors to friendly copy via `getUserFriendlyError()`
   - Stored in `resumes.errorMessage` and shown on dashboard
   - Examples: "Your PDF is password-protected", "No text could be extracted from your PDF"

4. **Client-Side Error Logging:**
   - `POST /api/client-error` endpoint logs JavaScript errors from browser
   - Includes stack trace, message, user agent for debugging

5. **Admin DLQ Alerts:**
   - DLQ consumer optionally sends alerts via webhook/email (configured by ALERT_CHANNEL env var)
   - Helps ops identify systemic failures in parsing pipeline

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.log()` / `console.error()` (Cloudflare Workers captures to log tail)
- Key patterns:
  - Queue message start/completion logged with resumeId
  - Error details logged with original error object for debugging
  - Cron results logged with counts (e.g., "expired 5 sessions")
  - Long-running operations timed with Date.now()

**Validation:**
- Approach: Zod schemas in `lib/schemas/`
- Route handlers parse request body/params against schema
- Queue consumer validates message schema before processing
- Examples: `lib/schemas/resume.ts` (ResumeContent shape), `lib/schemas/profile.ts` (PrivacySettings)
- Database layer enforces NOT NULL, enums, foreign keys

**Authentication:**
- Approach: Better Auth for core auth flow; session validation at page/API handler level
- Middleware checks session cookie exists (cookie-level security optimization)
- Handlers call `getServerSession()` for full validation (checks DB, expiry, user existence)
- Admin endpoints call `requireAdminAuth()` to verify isAdmin flag
- Examples: `lib/auth/session.ts`, `lib/auth/admin.ts`

**Authorization:**
- Approach: Row-level checks in handlers (no DB row-level security)
- Resume routes verify userId matches session.user.id
- Admin routes verify isAdmin = true
- Profile update endpoints check ownership
- Examples: All `PUT /api/profile/*` routes, `/api/admin/*` routes

**Rate Limiting:**
- Approach: IP-based (SHA256 hash of IP address)
- Tracks per action type (upload, handle check, email validate)
- TTL window configurable per action (default 24h, auto-cleanup)
- Examples: `lib/utils/rate-limit.ts`, called in upload/handle-check/email routes

**Caching:**
- Approach: Multi-layered
  - Edge cache (Cloudflare CDN): 1hr for public resumes, 5min for /explore, 1 week for static pages
  - Function-level cache: React `cache()` for `getServerSession()` within request
  - Module-level cache: WeakMap for auth instance (per D1 binding) and D1 proxy (date serialization)
- Examples: `lib/auth/session.ts` (React cache), `lib/auth/index.ts` (WeakMap), `next.config.ts` (Cache-Control headers)

**File Operations:**
- Approach: All file I/O via R2 bindings (no fs module — Workers restriction)
- Upload: Direct from browser to R2 via signed URL (no server intermediary)
- Retrieval: Queue consumer fetches PDF from R2 for parsing
- Deletion: On account deletion, orphaned resumes cleaned up via cron
- Examples: `lib/r2.ts` (R2 wrapper functions)

