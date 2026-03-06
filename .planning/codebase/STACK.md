# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code, type-safe from client to Worker
- JavaScript (React 19.2.4) - JSX/TSX components

**Secondary:**
- CSS (Tailwind 4.2.0) - Styling framework with PostCSS plugin

## Runtime

**Environment:**
- Node.js 25.6.1 - Development environment
- Bun 1.3.9 - Package manager and task runner (replaces npm)
- Cloudflare Workers - Serverless execution platform (production)

**Compatibility:**
- `nodejs_compat` flag enabled in Cloudflare Workers for Node.js API compatibility
- `global_fetch_strictly_public` flag enabled for fetch operations

**Package Manager:**
- Bun 1.3.9
- Lockfile: `bun.lockb` (present, Bun-specific)

## Frameworks

**Core:**
- vinext v0.0.20 (Vite-based Next.js) - App Router reimplementation on Vite for Cloudflare Workers
- @cloudflare/vite-plugin - Native Cloudflare Workers integration via Vite

**Authentication:**
- Better Auth 1.4.18 - Auth system with Google OAuth, email/password, drizzle adapter
  - Stores sessions, accounts, verifications in D1
  - Email providers: custom (Resend for transactional emails)

**Database:**
- Drizzle ORM 0.45.1 - Type-safe SQL ORM for D1/SQLite
- Drizzle Kit 0.31.9 - Migration generation and schema management
- D1 (Cloudflare SQLite) - Serverless SQL database

**UI Components:**
- Radix UI - Unstyled, accessible component library
  - `@radix-ui/react-dialog`, `react-label`, `react-progress`, `react-separator`, `react-slot`, `react-switch`
- class-variance-authority 0.7.1 - Component variant utility
- Lucide React 0.574.0 - Icon library
- Sonner 2.0.7 - Toast notifications

**AI & Resume Parsing:**
- Vercel AI SDK (ai 6.0.91) - LLM client abstraction
- @ai-sdk/openai-compatible 2.0.30 - OpenRouter provider (routes to Cerebras, DeepInfra, etc.)
- unpdf 1.4.0 - PDF text extraction (embedded in queue consumer)
- Zod 4.3.6 - Schema validation for AI outputs

**Analytics:**
- Umami (self-hosted at analytics.divkix.me) - Analytics platform
- Data fetched via Umami API (`lib/umami/client.ts`)

**Styling:**
- Tailwind CSS 4.2.0 - Utility-first CSS framework
- @tailwindcss/postcss 4.2.0 - PostCSS plugin
- PostCSS 8.5.6 - CSS transformation
- Tailwind Merge 3.5.0 - Merge Tailwind utility classes without conflicts
- tw-animate-css 1.4.0 - Animation utilities

**Forms & Validation:**
- React Hook Form 7.71.1 - Form state management
- @hookform/resolvers 5.2.2 - Schema resolvers (Zod integration)

**Themes:**
- next-themes 0.4.6 - Dark/light mode management

**Utilities:**
- ofetch 1.5.1 - Fetch wrapper (used for Resend HTTP API)
- clsx 2.1.1 - Class name utility
- @neoconfetti/react 1.0.0 - Confetti animation on success
- uplot 1.6.32 - Lightweight charting library (admin analytics)

## Testing

**Framework:**
- Vitest 4.0.18 - Unit test runner
- @vitest/coverage-v8 4.0.18 - Code coverage provider (V8 backend)
- jsdom 28.1.0 - DOM emulation for tests

**E2E Testing:**
- Playwright 1.58.2 - Browser automation
- @playwright/test 1.58.2 - Test runner for E2E

## Build & Development Tools

**Bundler:**
- Vite 7.x - Build tool and dev server (used by vinext)
- Wrangler 4.66.0 - Cloudflare Workers CLI
  - Bundle stubs handled by Vite resolve.alias (not wrangler esbuild)

**Code Quality:**
- Biome 2.4.2 - Linter + formatter (replaces ESLint/Prettier)
  - Config: `biome.json`
  - Spaces (2), double quotes, semicolons, trailing commas, 100 char line width
  - Organized imports via Biome assist

**Type Checking:**
- TypeScript 5.9.3 - Compiler for type validation
- Target: ES2022

**Utilities:**
- @noble/hashes 2.0.1 - Hashing library
- @next/bundle-analyzer 16.1.6 - Bundle size analysis (ANALYZE=true)
- sharp 0.34.5 - Image processing (server external package, not used)
- to-ico 1.1.5 - Favicon generation script

**Git Hooks:**
- Husky 9.1.7 - Git hook management
- lint-staged 16.2.7 - Staged file linting

## Key Dependencies

**Critical:**
- better-auth 1.4.18 - Full auth implementation (Google, email, session management)
- drizzle-orm 0.45.1 - Type-safe ORM for D1 queries
- @cloudflare/vite-plugin - Vite plugin for Cloudflare Workers integration
- ai 6.0.91 + @ai-sdk/openai-compatible 2.0.30 - LLM client with OpenRouter routing
- unpdf 1.4.0 - PDF extraction (embedded in queue consumer to keep Worker bundle small)
- zod 4.3.6 - Input validation and schema transformation

**Infrastructure:**
- Cloudflare Workers - Compute runtime
- Cloudflare D1 - SQLite database
- Cloudflare R2 - Object storage for PDF uploads
- Cloudflare KV - Disposable email domain blocklist
- Cloudflare Queues - Async resume parsing (main + dead letter queue)
- Cloudflare Durable Objects - WebSocket state for real-time status updates
- Cloudflare Cache API - Edge cache control and purging

## Configuration

**Environment:**
- Dev: `.dev.vars` (Vite/Wrangler loads for development)
- Prod: Cloudflare secrets (`wrangler secret put`)

**Build Configuration:**
- `vite.config.ts` - Vite build config, vinext + @cloudflare/vite-plugin, bundle stubs
- `next.config.ts` - vinext config (rewrites, redirects, CDN cache headers, security headers, CSP)
- `wrangler.jsonc` - Cloudflare Workers bindings, D1, R2, KV, Queues, Durable Objects, cron triggers
- `tsconfig.json` - TypeScript compiler options (strict mode, noEmit for type-check only)
- `vitest.config.ts` - Test environment (jsdom), coverage configuration
- `drizzle.config.ts` - Drizzle Kit pointing to local D1 SQLite file
- `biome.json` - Formatter/linter rules (spaces, quotes, line width)
- `postcss.config.mjs` - PostCSS with Tailwind plugin

**Build Optimization:**
- Bundle aliases in `vite.config.ts` resolve.alias:
  - `@vercel/og` → stub (2MB unused, doesn't work on Workers)
  - `@zxcvbn-ts/*` → stub (1.7MB, client-only password strength)
  - `zod/v3` → stub (128KB, dead code from @ai-sdk/provider-utils)
- Custom Vite plugin `cloudflare-workers-client-stub` stubs `cloudflare:workers` for client builds
- Custom Vite plugin `client-vendor-split` splits radix-ui, react-hook-form, better-auth into separate chunks

## Platform Requirements

**Development:**
- Node.js 25.x (for running Vite dev server)
- Bun 1.3.9+ (package manager, task runner)
- Cloudflare account with Workers, D1, R2, KV namespaces configured

**Production:**
- Cloudflare Workers (compute)
- Cloudflare D1 (database)
- Cloudflare R2 (file storage)
- Cloudflare KV (domain blocklist)
- Cloudflare Queues (async processing)
- Cloudflare Durable Objects (WebSocket state)
- OpenRouter API (via Cloudflare AI Gateway) for resume parsing
- Resend API (optional, for password reset emails)

## Secrets & Bindings

**Required Secrets (Cloudflare/dev):**
```
BETTER_AUTH_SECRET          # Session signing key
BETTER_AUTH_URL             # App URL (also used for email domain extraction)
GOOGLE_CLIENT_ID            # OAuth provider ID
GOOGLE_CLIENT_SECRET        # OAuth provider secret
CF_AI_GATEWAY_ACCOUNT_ID    # Cloudflare AI Gateway account
CF_AI_GATEWAY_ID            # Cloudflare AI Gateway instance ID
CF_AIG_AUTH_TOKEN           # Cloudflare AI Gateway auth token
```

**Optional Secrets:**
```
RESEND_API_KEY              # Email service (free tier: 3k/month)
CF_ZONE_ID                  # Cloudflare zone for cache purging
CF_CACHE_PURGE_API_TOKEN    # API token with Cache Purge permission
UMAMI_USERNAME              # Self-hosted Umami credentials
UMAMI_PASSWORD              # Self-hosted Umami credentials
CRON_SECRET                 # Bearer token for cron endpoint auth
ALERT_WEBHOOK_URL           # Slack/Discord webhook for DLQ alerts
```

**Bindings (wrangler.jsonc):**
```
CLICKFOLIO_DB        → D1 database (clickfolio-db)
CLICKFOLIO_R2_BUCKET → R2 bucket (clickfolio-bucket)
DISPOSABLE_DOMAINS  → KV namespace for email domain blocklist
RESUME_PARSE_QUEUE  → Queue for async resume parsing
RESUME_STATUS_DO    → Durable Object for WebSocket notifications
ASSETS              → Static assets from dist/client/
```

**Environment Variables (public):**
```
NEXT_PUBLIC_UMAMI_WEBSITE_ID    # Analytics tracker ID (public, sent to Umami)
NODE_ENV                        # "production" (set in wrangler.jsonc)
AI_MODEL                        # Default: "openai/gpt-oss-120b:nitro"
CF_ZONE_ID                      # Cloudflare zone ID (also in vars section)
```

---

*Stack analysis: 2026-02-26*
