# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**clickfolio.me** — Turn a PDF resume into a hosted web portfolio. Upload → AI Parse → Publish.

**Stack**: Next.js 16 (App Router) on Cloudflare Workers, D1 (SQLite) via Drizzle ORM, Better Auth (Google OAuth + email/password), R2 storage, AI parsing via Vercel AI SDK + unpdf (embedded in main worker), Durable Objects for WebSocket notifications.

## Commands

```bash
# Development
bun run dev              # Start dev server at localhost:3000
bun run lint             # Biome linting
bun run fix              # Biome auto-fix
bun run type-check       # TypeScript check without emit
bun run test             # Run tests (vitest)
bun run test:watch       # Run tests in watch mode
bun run analyze          # Bundle analysis (ANALYZE=true next build)

# Build & Deploy
bun run build            # Next.js production build
bun run build:worker     # OpenNext Cloudflare bundle
bun run preview          # Local Cloudflare preview
bun run deploy           # Build and deploy to Cloudflare Workers

# Database (D1 + Drizzle)
bun run db:generate      # Generate migrations from schema changes
bun run db:push          # Push schema to D1 directly (no migration)
bun run db:migrate       # Apply migrations locally
bun run db:migrate:prod  # Apply migrations to production
bun run db:studio        # Drizzle Studio UI (port 4984)
bun run db:reset         # Wipe local D1 and re-migrate
bun run db:seed:local    # Seed local D1 with test data
bun run db:reset:local   # Reset + seed local D1

# Direct D1 queries
bunx wrangler d1 execute clickfolio-db --local --command "SELECT * FROM user"
bunx wrangler d1 execute clickfolio-db --command "SELECT * FROM user"  # prod

# CI
bun run ci               # type-check + lint + test + build
```

## Critical Constraints

### Cloudflare Workers Limitations
- **No `fs` module** — use R2 bindings for file operations
- **No Next.js `<Image />`** — use `<img>` with CSS (`aspect-ratio`, `object-fit`)
- **No middleware D1 access** — Edge middleware can't call D1; move DB checks to page components/API routes

### Middleware Cookie Validation (Intentional Design)
The middleware (`middleware.ts`) only checks if a session cookie **exists**, not if it's **valid**. This is intentional:

1. **Edge middleware can't access D1** — Cloudflare Workers edge middleware cannot call D1 for session validation
2. **Defense in depth** — Page components and API routes perform full authentication via `requireAuthWithUserValidation()` which validates both the session AND that the user exists in the database
3. **Cookie existence is a UX optimization** — Prevents unnecessary redirects for clearly unauthenticated users (no cookie at all)

This means an attacker could set a fake cookie (`better-auth.session_token=fake`) to bypass middleware redirects, but they would fail at the page/API handler level where full validation occurs. This is acceptable because:
- No sensitive operations happen in middleware
- All data access requires valid auth checked at handler level
- The pattern is documented and expected

### D1/SQLite Constraints
- JSON stored as TEXT — always `JSON.parse()`/`JSON.stringify()`
- UUIDs generated in app code (`crypto.randomUUID()`)
- Booleans are INTEGER (0/1) — Drizzle handles via `{ mode: 'boolean' }`
- No row-level security — enforce authorization in application code

## Architecture

### Route Groups
```
app/
├── (auth)/                # /api/auth/* — Better Auth handlers
├── (public)/              # No auth required
│   ├── verify-email/      # Email verification flow (Better Auth)
│   └── ...
├── (protected)/           # Auth required (force-dynamic)
│   ├── dashboard/         # User dashboard (resume status, actions)
│   ├── edit/              # Content editor with auto-save
│   ├── settings/          # Privacy toggles, account settings
│   ├── themes/            # Theme selector (dedicated route)
│   ├── waiting/           # AI parsing status polling
│   └── wizard/            # 4-step onboarding flow
├── (admin)/               # Admin-only routes (requireAdminAuth)
│   └── admin/
│       ├── page.tsx       # Admin dashboard
│       ├── analytics/     # Umami analytics dashboard
│       ├── referrals/     # Referral tracking & management
│       ├── resumes/       # Resume audit
│       └── users/         # User management
├── explore/               # Public directory — browse portfolios
├── privacy/               # Privacy policy
├── terms/                 # Terms of service
├── reset-password/        # Password reset flow
├── preview/[id]/          # Template preview (thumbnail generation)
├── [handle]/              # Public resume viewer (SSR, privacy-filtered)
├── robots.ts              # robots.txt generation
├── sitemap.ts             # sitemap.xml generation
└── api/
    ├── auth/[...all]/     # Better Auth catchall
    ├── upload/            # POST — anonymous file upload to R2
    │   └── pending/       # GET — check temp upload status
    ├── resume/
    │   ├── claim/         # POST — link upload to user, trigger AI parse
    │   ├── status/        # GET — parsing status polling
    │   ├── latest-status/ # GET — latest status (no params)
    │   ├── update/        # PUT — edit resume content
    │   ├── update-theme/  # PUT — change template theme
    │   └── retry/         # POST — re-queue failed parse
    ├── site-data/         # GET — fetch parsed resume content
    ├── profile/
    │   ├── me/            # GET — current user info
    │   ├── handle/        # PUT — change handle
    │   ├── privacy/       # PUT — update privacy settings
    │   └── role/          # PUT — set user role
    ├── handle/check/      # POST — validate handle availability
    ├── user/stats/        # GET — portfolio views, referral counts
    ├── account/delete/    # DELETE — delete user account
    ├── wizard/complete/   # POST — finalize onboarding
    ├── og/
    │   ├── home/          # GET — OG image for homepage
    │   └── [handle]/      # GET — dynamic OG per resume
    ├── analytics/stats/   # GET — Umami stats proxy (public)
    ├── referral/track/    # POST — log referral conversion
    ├── client-error/      # POST — log client-side errors
    ├── sitemap-index/     # GET — sitemap index
    ├── cron/
    │   ├── cleanup/       # Scheduled: session/verification expiry
    │   └── recover-orphaned/ # Scheduled: orphaned resume recovery
    └── admin/
        ├── analytics/     # GET — Umami admin proxy
        ├── stats/         # GET — Umami stats (admin)
        ├── referrals/     # GET — all referral data
        ├── resumes/       # GET — audit all uploads
        └── users/         # GET — user list + stats
```

### The Claim Check Pattern
Anonymous users upload before auth:
1. `POST /api/upload` → Upload file directly to Worker, stored in R2 via binding
2. Worker returns temp key, stored in `localStorage` as `temp_upload_id`
3. User authenticates via Google OAuth
4. `POST /api/resume/claim` → links upload to user, triggers AI parsing
5. Status polling at `/api/resume/status` (3s intervals, ~30-40s parse time)

### Database Schema
Tables in `lib/db/schema.ts`:
- **user** — Better Auth managed + custom fields (handle, headline, privacySettings, onboardingCompleted, referralCode, referralCount, referredBy, isPro, isAdmin, showInDirectory, role, roleSource)
- **session**, **account**, **verification** — Better Auth managed
- **resumes** — PDF uploads, status enum: `pending_claim` → `processing` → `completed`/`failed`
- **siteData** — Parsed resume content (JSON TEXT), theme selection
- **handleChanges** — Handle change audit trail
- **uploadRateLimits** — IP-based rate limiting
- **referralClicks** — Referral click tracking with visitor deduplication (unique index on referrerUserId + visitorHash)

### Referral System
- Each user gets a permanent `referralCode` on signup
- `referralClicks` tracks clicks with idempotent deduplication via visitor hash
- `referralCount` denormalized on user table for efficient sorting
- Premium templates gated behind referral thresholds (3, 5, or 10 referrals)
- `isThemeUnlocked()` in `lib/templates/theme-ids.ts` checks unlock status

### Analytics
Analytics via self-hosted Umami (analytics.divkix.me). Tracker script loaded in `app/layout.tsx` with `data-before-send` for self-view filtering. Stats proxied via `/api/analytics/stats` (public) and `/api/admin/analytics` (admin).

### Auth Usage

**Server-side:**
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

**Client-side:**
```typescript
import { useSession, signIn, signOut } from "@/lib/auth/client";
// signIn.social({ provider: "google" })
```

### Privacy Filtering
Before rendering `/[handle]`:
```typescript
const settings = JSON.parse(user.privacySettings || "{}");
if (!settings.show_phone) delete content.contact.phone;
if (!settings.show_address) content.contact.location = extractCityState(...);
```

### Caching Architecture

**Cloudflare CDN Edge Cache:**
- Configured via `Cache-Control` headers in `next.config.ts`
- Public resumes: 1hr TTL, 24hr stale-while-revalidate
- Explore page: 5min TTL
- Static pages (/privacy, /terms): 1 week TTL
- Privacy-sensitive changes purge edge cache immediately via Cloudflare API

**No ISR layer** - All requests hit D1 directly. Edge cache handles most traffic.

## Code Standards

- **Package manager**: bun only (never npm/yarn/pnpm)
- **Formatting**: Biome — spaces (2), double quotes, semicolons, trailing commas
- **Commits**: Conventional format with details
- **Testing**: Vitest (`bun run test`)
- **Images**: Use `<img>` tags, never Next.js `<Image />`
- **D1 migrations**: Use Supabase CLI patterns via `bun run db:generate` then `db:migrate`
- **Git hooks**: Husky (`bun run prepare`)

## Templates

Ten resume templates in `components/templates/`, registered in `lib/templates/theme-ids.ts`:

**Free (0 referrals):**
- **MinimalistEditorial** (default) — clean magazine-style, serif
- **NeoBrutalist** — bold borders, high contrast
- **GlassMorphic** — dark theme with frosted glass effects
- **BentoGrid** — modern mosaic layout with colorful cards
- **ClassicATS** — single-column ATS-optimized, legal brief typography
- **DevTerminal** — GitHub-inspired dark terminal aesthetic

**Premium (referral-gated):**
- **DesignFolio** (3 referrals) — digital brutalism meets Swiss typography
- **Spotlight** (3 referrals) — warm creative portfolio with animations
- **Midnight** (5 referrals) — dark minimal, serif headings, gold accents
- **BoldCorporate** (10 referrals) — executive typography, bold numbered sections

Template registry: `lib/templates/theme-ids.ts` (metadata, unlock logic) and `lib/templates/theme-registry.tsx` (dynamic imports).

All receive `content` (ResumeContent) and `user` props, must respect privacy settings and be mobile-responsive.

## Key Files

- `lib/db/schema.ts` — Drizzle schema definitions (10 tables)
- `lib/auth/index.ts` — Better Auth server config (cached via WeakMap)
- `lib/auth/client.ts` — Client hooks (useSession, signIn, signOut)
- `lib/auth/admin.ts` — Admin auth handler (requireAdminAuth)
- `lib/auth/middleware.ts` — Middleware auth validation
- `lib/auth/session.ts` — Session utilities
- `lib/r2.ts` — R2 binding wrapper functions
- `lib/ai/` — AI parsing modules (pdf-extract, ai-parser, ai-normalize, ai-fallback, transform)
- `lib/referral.ts` — Referral system business logic
- `lib/umami/client.ts` — Umami API client (auth, stats, active visitors)
- `lib/schemas/` — Zod validation schemas (resume, profile, account, auth)
- `lib/templates/theme-ids.ts` — Template metadata, unlock logic, categories
- `lib/templates/theme-registry.tsx` — Dynamic template imports (server + client)
- `lib/cron/cleanup.ts` — Session/verification expiry cleanup
- `lib/cron/recover-orphaned.ts` — Orphaned resume recovery
- `lib/queue/` — Async resume parsing queue (6 files, includes DLQ consumer)
- `lib/cloudflare-cache-purge.ts` — Edge cache invalidation
- `wrangler.jsonc` — Cloudflare Workers config (D1, R2, Queue, Durable Objects)
- `drizzle.config.ts` — Drizzle config pointing to local D1

## Environment Variables

Required in `.env.local` (dev) and Cloudflare secrets (prod):
```
BETTER_AUTH_SECRET, BETTER_AUTH_URL   # BETTER_AUTH_URL is also used as the app URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
RESEND_API_KEY              # For password reset emails (optional, free tier: 3k/month)
```

Optional (for edge cache purging on custom domains):
```
CF_ZONE_ID                  # Cloudflare zone ID from dashboard
CF_CACHE_PURGE_API_TOKEN    # API token with Cache Purge permission
```

AI Provider (required for resume parsing):
```
# Cloudflare AI Gateway (proxies to OpenRouter)
CF_AI_GATEWAY_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_AUTH_TOKEN
AI_MODEL                    # Model ID (default: openai/gpt-oss-120b:nitro, set in wrangler.jsonc)
```

Analytics (Umami — self-hosted at analytics.divkix.me):
```
NEXT_PUBLIC_UMAMI_WEBSITE_ID    # Public, embedded in tracker script
UMAMI_API_URL                   # Umami instance URL (server-side stats proxy)
UMAMI_USERNAME, UMAMI_PASSWORD  # Umami API credentials for stats
```

Cron & Alerting (optional):
```
CRON_SECRET                 # Bearer token for authenticating cron endpoints
ALERT_CHANNEL               # DLQ alert channel: logpush | webhook | email (default: logpush)
ALERT_WEBHOOK_URL           # Webhook URL for DLQ alerts (Slack/Discord)
```

Note: R2 is accessed via binding in `wrangler.jsonc` - no API credentials needed.

## Gotchas

1. **"Cannot find module 'fs'"** — You're on Workers, use R2 bindings for file operations
2. **Auth redirect loop** — Check `BETTER_AUTH_URL` matches deployment URL exactly
3. **R2 CORS errors** — Add localhost:3000 AND production URL to R2 CORS config
4. **Parsing stuck** — Check AI provider is configured (CF_AI_GATEWAY_*), use retry button (max 2 retries)
5. **D1 JSON returning strings** — Always parse TEXT fields with JSON.parse()
6. **Drizzle snapshot JSON formatting** — Run `bun run fix` after `db:generate` to fix formatting
