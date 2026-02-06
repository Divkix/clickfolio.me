# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**clickfolio.me** — Turn a PDF resume into a hosted web portfolio. Upload → AI Parse → Publish.

**Stack**: Next.js 16 (App Router) on Cloudflare Workers, D1 (SQLite) via Drizzle ORM, Better Auth (Google OAuth), R2 storage, AI parsing via Vercel AI SDK + unpdf (embedded in main worker).

## Commands

```bash
# Development
bun run dev              # Start dev server at localhost:3000
bun run lint             # Biome linting
bun run fix              # Biome auto-fix
bun run type-check       # TypeScript check without emit

# Build & Deploy
bun run build            # Next.js production build
bun run build:worker     # OpenNext Cloudflare bundle
bun run preview          # Local Cloudflare preview
bun run deploy           # Build and deploy to Cloudflare Workers

# Database (D1 + Drizzle)
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Apply migrations locally
bun run db:migrate:prod  # Apply migrations to production
bun run db:studio        # Drizzle Studio UI (port 4984)
bun run db:reset         # Wipe local D1 and re-migrate

# Direct D1 queries
bunx wrangler d1 execute clickfolio-db --local --command "SELECT * FROM user"
bunx wrangler d1 execute clickfolio-db --command "SELECT * FROM user"  # prod

# CI
bun run ci               # type-check + lint + build
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
├── (auth)/              # /api/auth/* — Better Auth handlers
├── (public)/            # / and /[handle] — no auth required
│   ├── page.tsx         # Homepage with FileDropzone
│   └── [handle]/        # Public resume viewer (SSR, privacy-filtered)
└── (protected)/         # Auth required
    ├── dashboard/       # User dashboard
    ├── edit/            # Content editor with auto-save
    ├── settings/        # Privacy toggles, theme selection
    ├── waiting/         # AI parsing status polling
    └── wizard/          # 4-step onboarding flow
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
- **user** — Better Auth managed + custom fields (handle, headline, privacySettings, onboardingCompleted)
- **session**, **account**, **verification** — Better Auth managed
- **resumes** — PDF uploads, status enum: `pending_claim` → `processing` → `completed`/`failed`
- **siteData** — Parsed resume content (JSON TEXT), theme selection
- **handleChanges** — Handle change audit trail
- **uploadRateLimits** — IP-based rate limiting

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
- Static pages (/privacy, /terms): 1 week TTL
- Privacy-sensitive changes purge edge cache immediately via Cloudflare API

**No ISR layer** - All requests hit D1 directly. Edge cache handles most traffic.

## Code Standards

- **Package manager**: bun only (never npm/yarn/pnpm)
- **Formatting**: Biome — spaces (2), double quotes, semicolons, trailing commas
- **Commits**: Conventional format with details
- **Images**: Use `<img>` tags, never Next.js `<Image />`
- **D1 migrations**: Use Supabase CLI patterns via `bun run db:generate` then `db:migrate`

## Templates

Four resume templates in `components/templates/`:
- **MinimalistEditorial** (default) — serif, editorial aesthetic
- **NeoBrutalist** — bold borders, high contrast
- **GlassMorphic** — blur effects, dark background
- **BentoGrid** — mosaic grid layout

All receive `content` (ResumeContent) and `user` props, must respect privacy settings and be mobile-responsive.

## Key Files

- `lib/db/schema.ts` — Drizzle schema definitions
- `lib/auth/index.ts` — Better Auth server config
- `lib/auth/client.ts` — Client hooks (useSession, signIn, signOut)
- `lib/r2.ts` — R2 binding wrapper functions
- `lib/ai/` — AI parsing modules (PDF extraction via unpdf, structured output via Vercel AI SDK)
- `lib/schemas/resume.ts` — Zod validation with XSS sanitization
- `wrangler.jsonc` — Cloudflare Workers config (D1 binding: `DB`)
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
```

Note: R2 is accessed via binding in `wrangler.jsonc` - no API credentials needed.

## Gotchas

1. **"Cannot find module 'fs'"** — You're on Workers, use R2 bindings for file operations
2. **Auth redirect loop** — Check `BETTER_AUTH_URL` matches deployment URL exactly
3. **R2 CORS errors** — Add localhost:3000 AND production URL to R2 CORS config
4. **Parsing stuck** — Check AI provider is configured (CF_AI_GATEWAY_*), use retry button (max 2 retries)
5. **D1 JSON returning strings** — Always parse TEXT fields with JSON.parse()
