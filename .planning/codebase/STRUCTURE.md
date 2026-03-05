# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
clickfolio.me/
├── app/                          # vinext App Router — pages and API routes
│   ├── layout.tsx                # Root layout with Umami tracker
│   ├── robots.ts                 # robots.txt generation
│   ├── sitemap.ts                # sitemap.xml generation
│   ├── (auth)/                   # Better Auth routes (handled by auth/[...all])
│   ├── (public)/                 # Public routes requiring no authentication
│   │   └── verify-email/         # Email verification callback page
│   ├── (protected)/              # Auth-required routes (force-dynamic)
│   │   ├── dashboard/            # Resume status, referral stats, profile completeness
│   │   ├── edit/                 # Content editor with live updates
│   │   ├── settings/             # Privacy toggles, account settings, email verification
│   │   ├── themes/               # Template selector with referral unlock gates
│   │   ├── waiting/              # Parsing status polling (legacy, WebSocket preferred)
│   │   ├── wizard/               # 4-step onboarding (name, handle, headline, role)
│   │   └── layout.tsx            # Protected layout — session validation, sidebar
│   ├── [handle]/                 # Public resume viewer (SSR, privacy-filtered)
│   ├── explore/                  # Directory — browse public portfolios
│   ├── privacy/                  # Privacy policy
│   ├── terms/                    # Terms of service
│   ├── reset-password/           # Password reset flow
│   ├── preview/[id]/             # Template preview thumbnails
│   ├── error.tsx                 # Root error boundary
│   ├── globals.css               # Tailwind + custom variables
│   └── api/                      # API routes (34 endpoints)
│       ├── auth/[...all]/        # Better Auth catch-all handler
│       ├── upload/               # Anonymous file upload to R2 (POST) + status check (GET pending)
│       ├── resume/               # Resume management
│       │   ├── claim/            # Link upload to user, trigger parse
│       │   ├── status/           # Polling endpoint for parse status
│       │   ├── latest-status/    # Latest status without params
│       │   ├── update/           # Edit resume content
│       │   ├── update-theme/     # Change template theme
│       │   └── retry/            # Re-queue failed parse (max 2 retries)
│       ├── profile/              # User profile management
│       │   ├── me/               # Get current user info
│       │   ├── handle/           # Change handle (with change audit trail)
│       │   ├── privacy/          # Update privacy settings
│       │   └── role/             # Set user role
│       ├── handle/check/         # Validate handle availability
│       ├── email/validate/       # Validate email not disposable
│       ├── user/stats/           # Portfolio views, referral counts
│       ├── account/delete/       # Delete user account
│       ├── wizard/complete/      # Finalize onboarding
│       ├── site-data/            # Fetch parsed resume content
│       ├── og/                   # OG image generation
│       │   ├── home/             # Homepage OG image
│       │   └── [handle]/         # Per-resume OG image
│       ├── analytics/            # Umami stats proxy (public read)
│       ├── referral/track/       # Log referral clicks + conversions
│       ├── client-error/         # Log client-side JavaScript errors
│       ├── sitemap-index/        # Sitemap index for large directory
│       ├── health/               # Health check for monitoring
│       ├── cron/                 # Scheduled tasks (callable via API or cron trigger)
│       │   ├── cleanup/          # Expire sessions/verifications
│       │   ├── recover-orphaned/ # Re-queue stuck resumes
│       │   └── sync-domains/     # Sync disposable email blocklist
│       └── admin/                # Admin-only endpoints (requireAdminAuth)
│           ├── analytics/        # Umami admin proxy
│           ├── stats/            # Umami stats with admin API token
│           ├── referrals/        # All referral data
│           ├── resumes/          # Audit all uploads
│           └── users/            # User list + stats
│
├── components/                   # React components (12 subdirectories)
│   ├── ui/                       # Shadcn-like base components (Button, Card, Input, etc.)
│   ├── templates/                # 10 resume templates (free + premium)
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── AnalyticsCard.tsx
│   │   ├── CopyLinkButton.tsx
│   │   ├── DashboardUploadSection.tsx
│   │   ├── EmailVerificationBanner.tsx
│   │   ├── RealtimeStatusListener.tsx   # WebSocket client for resume status
│   │   └── ReferralStats.tsx
│   ├── forms/                    # Form components with sections
│   │   ├── sections/             # ResumeForm sections (experience, education, skills, etc.)
│   ├── wizard/                   # Onboarding steps
│   ├── auth/                     # Auth UI (login, signup, OAuth button)
│   ├── explore/                  # Directory components (filters, cards)
│   ├── home/                     # Homepage components
│   ├── admin/                    # Admin dashboard pages
│   ├── analytics/                # Umami tracker integration
│   ├── settings/                 # Settings page components
│   └── (other utility components)
│
├── lib/                          # Application logic and utilities
│   ├── auth/                     # Authentication
│   │   ├── index.ts              # Better Auth server config (WeakMap-cached)
│   │   ├── client.ts             # Client hooks (useSession, signIn, signOut)
│   │   ├── session.ts            # Cached session getter (React cache())
│   │   ├── admin.ts              # Admin auth validation
│   │   └── middleware.ts         # Edge middleware auth (cookie presence check)
│   ├── db/                       # Database
│   │   ├── schema.ts             # Drizzle schema (10 tables + relations + types)
│   │   └── index.ts              # getDb() helper
│   ├── queue/                    # Async resume parsing
│   │   ├── consumer.ts           # Main queue handler (resume parsing)
│   │   ├── dlq-consumer.ts       # Dead letter queue handler
│   │   ├── errors.ts             # Error classification (QueueError, patterns)
│   │   ├── notify-status.ts      # Send status updates to ResumeStatusDO
│   │   └── types.ts              # Message schema (QueueMessage, ResumeParseMessage)
│   ├── ai/                       # AI resume parsing
│   │   ├── pdf-extract.ts        # Extract text from PDF (unpdf)
│   │   ├── ai-parser.ts          # Structured parsing via Vercel AI SDK
│   │   ├── ai-normalize.ts       # Normalize dates, deduplicate skills
│   │   ├── ai-fallback.ts        # Fallback parsing if AI fails
│   │   └── transform.ts          # Transform to ResumeContent type
│   ├── cron/                     # Scheduled tasks
│   │   ├── cleanup.ts            # Expire sessions/verifications
│   │   ├── recover-orphaned.ts   # Re-queue stuck resumes
│   │   └── sync-disposable-domains.ts  # Update KV blocklist
│   ├── durable-objects/          # Cloudflare Durable Objects
│   │   └── resume-status.ts      # WebSocket server for real-time status
│   ├── email/                    # Email delivery
│   │   ├── resend.ts             # Resend API integration
│   │   └── disposable-check.ts   # Check against KV blocklist
│   ├── data/                     # Data queries and builders
│   │   ├── resume.ts             # Fetch resume metadata + content with privacy filters
│   │   ├── site-data-upsert.ts   # Build upsert for siteData (parsed content)
│   │   └── (other data helpers)
│   ├── templates/                # Template management
│   │   ├── theme-ids.ts          # Theme enum, metadata, unlock logic
│   │   └── theme-registry.tsx    # Dynamic imports of template components
│   ├── schemas/                  # Zod validation
│   │   ├── resume.ts             # ResumeContent schema
│   │   ├── profile.ts            # PrivacySettings schema
│   │   ├── account.ts            # Account update schemas
│   │   └── auth.ts               # Login/signup schemas
│   ├── types/                    # TypeScript types
│   │   ├── database.ts           # ResumeContent, PrivacySettings types
│   │   └── (other types)
│   ├── utils/                    # Utility functions
│   │   ├── rate-limit.ts         # IP-based rate limiting
│   │   ├── referral-code.ts      # Generate unique referral codes
│   │   ├── handle-validation.ts  # Validate handle format (alphanumeric, 3-30 chars)
│   │   ├── privacy-filters.ts    # Redact PII from resume
│   │   ├── profile-completeness.ts  # Calculate % complete, suggest missing fields
│   │   ├── format.ts             # Format utilities (relative time, truncate)
│   │   ├── json-ld.ts            # Generate structured data (breadcrumb, resume schema)
│   │   ├── cloudflare-cache-purge.ts  # Invalidate CDN cache
│   │   └── (other utils)
│   ├── config/                   # Configuration
│   │   └── site.ts               # Site metadata (domain, name, keywords)
│   ├── r2.ts                     # R2 object storage wrapper
│   ├── umami/                    # Analytics
│   │   └── client.ts             # Umami API client (stats, active visitors)
│   ├── stubs/                    # Bundle size stubs
│   │   ├── og-stub.ts            # @vercel/og stub (doesn't work on Workers)
│   │   ├── zxcvbn-stub.ts        # @zxcvbn-ts stub (SSR not needed)
│   │   └── zod-v3-stub.ts        # zod/v3 stub (v4 compat import only)
│   └── cloudflare-env.d.ts       # CloudflareEnv type definition
│
├── __tests__/                    # Vitest test files
│   ├── unit/                     # Unit tests
│   │   ├── ai/                   # AI module tests
│   │   └── templates/            # Template tests
│   ├── integration/              # Integration tests
│   │   ├── queue/                # Queue consumer tests
│   │   ├── cron/                 # Cron task tests
│   │   └── utils/                # Utility tests
│   ├── e2e/                      # End-to-end tests
│   │   └── fixtures/             # Test data
│
├── dist/                         # Vite build output (generated)
│   └── client/                   # Static assets served by ASSETS binding
├── .wrangler/                    # Wrangler state (local D1, KV, Durable Objects)
├── .localflare/                  # Local Cloudflare environment cache
├── .planning/codebase/           # Architecture documentation (this directory)
│
├── worker/
│   └── index.ts                  # Custom Cloudflare Worker entry point
│       ├── Intercepts WebSocket upgrades for resume status
│       ├── Serves static assets from ASSETS binding
│       ├── Routes HTTP to vinext app-router-entry handler
│       ├── Implements queue consumer (resume-parse-queue, resume-parse-dlq)
│       └── Implements scheduled task handler (cron triggers)
│
├── proxy.ts                      # Edge proxy (vinext's replacement for middleware.ts)
│   ├── Checks session cookie exists on protected routes
│   ├── Redirects unauthenticated users to home
│   └── Note: Full auth validation happens in page components/handlers
│
├── vite.config.ts                # Vite build configuration
│   ├── vinext + @cloudflare/vite-plugin
│   ├── cloudflare:workers client stub plugin
│   ├── Client vendor split plugin
│   └── Bundle stubs via resolve.alias (vercel/og, zxcvbn, zod/v3)
│
├── next.config.ts                # vinext configuration
│   ├── Old URL redirects (/@handle format)
│   ├── Edge cache headers (Cache-Control)
│   └── Security headers (CSP, HSTS)
│
├── wrangler.jsonc                # Cloudflare Workers configuration
│   ├── D1 database binding
│   ├── R2 bucket binding
│   ├── KV binding (disposable domains)
│   ├── Queue bindings (main + DLQ)
│   ├── Durable Object bindings
│   └── Cron triggers (0 3 * * *, 0 4 * * *, */15 * * * *)
│
├── drizzle.config.ts             # Drizzle ORM config
├── package.json                  # Dependencies, scripts
├── bun.lockb                      # Bun lockfile
├── tsconfig.json                 # TypeScript config
├── biome.json                    # Biome formatter/linter config
└── CLAUDE.md                     # Project guidelines (in repo)
```

## Directory Purposes

**app/ (vinext App Router):**
- Purpose: Route definitions, page rendering, API endpoints
- Contains: Server Components, client components, layout wrapping, API route handlers
- Key files: `layout.tsx` (root), `(protected)/layout.tsx` (auth wrapper), `[handle]/page.tsx` (public viewer)

**components/ (React Components):**
- Purpose: Reusable UI components and template implementations
- Contains: Base UI (button, input, card), form sections, page-specific components, 10 resume templates
- Key files: `templates/` (template imports), `dashboard/` (dashboard cards), `forms/` (edit form sections)

**lib/ (Business Logic & Utilities):**
- Purpose: Core application logic, database, auth, parsing, validation
- Contains: Drizzle schema, Better Auth config, queue consumers, AI modules, validation schemas, utilities
- Key files: `db/schema.ts` (10 tables), `auth/index.ts` (Better Auth), `queue/consumer.ts` (resume parsing), `schemas/` (Zod validation)

**__tests__/ (Tests):**
- Purpose: Vitest test files (unit, integration, e2e)
- Contains: Mock data, test utilities, test suites
- Run with: `bun run test`

## Key File Locations

**Entry Points:**
- `worker/index.ts`: Cloudflare Worker handler (fetch, queue, scheduled)
- `app/layout.tsx`: Root vinext layout, loads Umami tracker
- `proxy.ts`: Edge proxy (vinext's middleware replacement), validates session cookie

**Configuration:**
- `vite.config.ts`: Vite build config, vinext + @cloudflare/vite-plugin, bundle stubs
- `wrangler.jsonc`: Cloudflare bindings, D1, R2, queues, cron
- `next.config.ts`: vinext config, redirects, cache headers, security headers
- `tsconfig.json`: TypeScript paths, strict mode
- `biome.json`: Formatter/linter rules (spaces, 100 char width)

**Core Logic:**
- `lib/db/schema.ts`: Drizzle schema (10 tables, relations, types)
- `lib/auth/index.ts`: Better Auth server config (WeakMap caching)
- `lib/queue/consumer.ts`: Resume parsing pipeline (PDF extract → AI parse → upsert siteData)
- `lib/queue/errors.ts`: Error classification (retryable vs permanent)

**Database:**
- `lib/db/schema.ts`: Complete schema with indexes and relations
- `lib/data/resume.ts`: Fetch resume with privacy filters
- `lib/data/site-data-upsert.ts`: Build upsert for parsed content

**Templates:**
- `components/templates/`: 10 template components (MinimalistEditorial, NeoBrutalist, GlassMorphic, BentoGrid, ClassicATS, DevTerminal, DesignFolio, Spotlight, Midnight, BoldCorporate)
- `lib/templates/theme-ids.ts`: Metadata, unlock logic (referral gates)
- `lib/templates/theme-registry.tsx`: Dynamic imports

**Validation:**
- `lib/schemas/resume.ts`: ResumeContent schema
- `lib/schemas/profile.ts`: PrivacySettings schema
- `lib/schemas/auth.ts`: Login/signup validation

**Utilities:**
- `lib/utils/rate-limit.ts`: IP-based rate limiting
- `lib/utils/handle-validation.ts`: Handle format validation (alphanumeric, 3-30 chars)
- `lib/utils/privacy-filters.ts`: Redact phone, address from resume
- `lib/utils/json-ld.ts`: Structured data (breadcrumb, resume schema)

**Testing:**
- `__tests__/unit/ai/`: AI module tests
- `__tests__/integration/queue/`: Queue consumer tests
- Test utilities in `__tests__/integration/utils/`

## Naming Conventions

**Files:**
- Pages: `page.tsx` (vinext/Next.js convention)
- Layouts: `layout.tsx`
- API routes: `route.ts` (in `app/api/path/`)
- Components: PascalCase (e.g., `DashboardCard.tsx`, `Button.tsx`)
- Utilities: camelCase (e.g., `rate-limit.ts`, `handle-validation.ts`)
- Types: plural for domain (e.g., `database.ts` for types), singular for schema (e.g., `resume.ts` for Zod)
- Tests: `*.test.ts` suffix

**Directories:**
- Route groups: Parentheses `(auth)`, `(protected)`, `(public)`
- Dynamic routes: Square brackets `[handle]`, `[...all]`
- Feature directories: kebab-case (`dashboard/`, `admin/`, `explore/`)
- Library subdirectories: kebab-case (`rate-limit/`, `schema/`)

**Functions & Variables:**
- Handlers: camelCase, prefixed with action (`handleQueueMessage`, `handleResumeParse`)
- Getters: `get*` or `fetch*` (e.g., `getDb()`, `getTemplate()`, `getResumeData()`)
- Validators: `is*` or `validate*` (e.g., `isValidHandleFormat()`, `validateEmail()`)
- API route handlers: `GET`, `POST`, `PUT`, `DELETE` (uppercase, HTTP verbs)
- Components: PascalCase
- Hooks: `use*` prefix (e.g., `useSession()`)

**Constants & Enums:**
- Theme IDs: SCREAMING_SNAKE_CASE in enum, lowercase underscore in DB (e.g., `minimalist_editorial`)
- Error types: SCREAMING_SNAKE_CASE enum (e.g., `QueueErrorType.DB_CONNECTION_ERROR`)
- Status values: lowercase with underscore (e.g., `"pending_claim"`, `"processing"`)

## Where to Add New Code

**New Feature (e.g., "User favorited templates"):**
- Schema: Add table to `lib/db/schema.ts` (with indexes, relations)
- API: Create `app/api/favorite/route.ts` for endpoints
- Components: UI in `components/` (e.g., `components/FavoriteButton.tsx`)
- Types: Add types to `lib/types/database.ts`
- Tests: `__tests__/unit/` and `__tests__/integration/`

**New Page/Route:**
- Public: `app/public-name/page.tsx`
- Protected: `app/(protected)/name/page.tsx`
- Admin: `app/(admin)/admin/name/page.tsx`
- Create `loading.tsx` and `error.tsx` in same directory
- If requires auth: Call `getServerSession()` at top, redirect if null
- If protected: Middleware auto-redirects if no session cookie

**New API Endpoint:**
- Path: `app/api/resource/action/route.ts`
- Structure:
  ```typescript
  export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session) return Response.json({error: "Unauthorized"}, {status: 401});
    // ... handler logic
  }
  ```
- Validation: Parse request body against Zod schema
- Return: `Response.json({ data: ... }, { status: 200 })` or error

**New Component:**
- Location: `components/feature/ComponentName.tsx`
- If "use client" needed: Add `"use client"` at top
- Import shadcn/custom UI from `components/ui/`
- Props: Type with TypeScript interface or `React.PropsWithChildren<{ ... }>`

**New Utility:**
- Location: `lib/utils/feature-name.ts`
- Export: Named exports (not default)
- Tests: `__tests__/unit/` with `.test.ts` suffix

**New Template:**
- Location: `components/templates/TemplateName.tsx`
- Props: `{ content: ResumeContent; user: User }`
- Register: Add to `lib/templates/theme-ids.ts` enum and metadata
- Import: Add dynamic import to `lib/templates/theme-registry.tsx`

**Database Migration:**
- Schema change: Edit `lib/db/schema.ts`
- Generate: `bun run db:generate`
- Review: Check `.migrations/` for correctness
- Apply: `bun run db:migrate` (local) or `bun run db:migrate:prod` (production)

**Async Queue Task:**
- Location: `lib/queue/` subdirectory or handler in `lib/queue/consumer.ts`
- Pattern: Parse message, validate idempotency, process, notify on completion
- Errors: Use `classifyQueueError()` to determine retry/DLQ routing
- Notification: Call `notifyStatusChange()` to push to ResumeStatusDO

**Scheduled Cron Task:**
- Logic: Create function in `lib/cron/task-name.ts`
- Register: Add case in `worker.ts` scheduled handler
- Trigger: Add cron pattern to `wrangler.jsonc`
- Test: Call directly from API route via `lib/cron/cleanup.ts` pattern

## Special Directories

**Built/Generated:**
- `dist/`: Vite build output (vinext compiled for Workers)
  - Generated: `bun run build`
  - Committed: No (in .gitignore)
  - Contains: `dist/client/` (static assets), worker bundle

- `.wrangler/`: Wrangler state (local D1 database, KV, Durable Objects)
  - Generated: Automatically on first `bun run dev` or `bun run preview`
  - Committed: No (in .gitignore)
  - Reset: `rm -rf .wrangler/`

- `.next/`: vinext build cache
  - Committed: No

- `node_modules/`, `bun.lockb`: Dependencies
  - Installed: `bun install`
  - Committed: `bun.lockb` only, not node_modules

**.planning/codebase/:**
- Purpose: Architecture documentation
- Committed: Yes (reference for future work)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**.claude/, .conductor/, .playwright-mcp/:**
- Purpose: Development tool state
- Committed: Conditionally (plans/decisions, not cache)

