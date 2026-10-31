# clickfolio.me

**Turn your PDF resume into a hosted web portfolio in under 60 seconds.**

Upload a PDF. AI parses it. Get a shareable link.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020)](https://workers.cloudflare.com/)
[![TanStack Start](https://img.shields.io/npm/v/@tanstack/react-start?label=TanStack%20Start&color=blue)](https://tanstack.com/start)

---

## Features

- **Instant PDF Parsing** - AI extracts your information automatically
- **Clean Public URLs** - Get `yoursite.com/yourname` immediately
- **Privacy Controls** - Show/hide phone numbers and addresses
- **Multiple Templates** - Professional, modern designs
- **Mobile Responsive** - Looks great on all devices
- **SEO Optimized** - Proper metadata, Open Graph tags

---

## Tech Stack

| Layer          | Technology                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | [TanStack Start](https://tanstack.com/start) (React 19, Vite, file routes + server functions)                                                                                                       |
| **Runtime**    | [Cloudflare Workers](https://workers.cloudflare.com)                                                                                                                                                |
| **Database**   | [PlanetScale Postgres](https://planetscale.com) via [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) + [Drizzle ORM](https://orm.drizzle.team) (node-postgres `pg` >= 8.16.3) |
| **Auth**       | [Clerk](https://clerk.com) (Google OAuth + credentials; prebuilt `<SignIn>/<SignUp>` UI, JWKS-verified session JWTs)                                                                                |
| **Storage**    | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible)                                                                                                                              |
| **AI Parsing** | [OpenRouter](https://openrouter.ai) via [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) (openai/gpt-oss models)                                                              |
| **Styling**    | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS 4](https://tailwindcss.com)                                                                                                                      |

---

## Why Cloudflare Workers?

We chose Cloudflare Workers over traditional hosting for several reasons:

### Performance

- **Edge Computing**: Code runs in 300+ data centers worldwide, closest to your users
- **Cold Start**: ~0ms cold starts vs. 200-500ms on traditional serverless
- **Latency**: Sub-50ms response times globally

### Cost Efficiency

- **Free Tier**: 100,000 requests/day free
- **Hyperdrive**: Free connection pooling and query caching for Postgres at the edge
- **R2 Storage**: 10GB free, no egress fees
- **Total**: A production app can run free for most use cases (plus PlanetScale/Clerk free tiers)

### Developer Experience

- **No Container Management**: Just deploy code
- **Automatic Scaling**: From 0 to millions of requests
- **Integrated Stack**: Hyperdrive, R2, Workflows, and Durable Objects work seamlessly together

### Trade-offs

- **No `fs` Module**: Must use R2 for file operations
- **No image optimizer**: Use `<img>` with CSS instead
- **No DB in the Worker gate**: The Worker entry only strips/forwards requests; pages and APIs authenticate themselves
- **Bundle Size**: Keep dependencies minimal

---

## Quick Start

### Prerequisites

- [pnpm](https://pnpm.io) v11+ (package manager)
- [Cloudflare Account](https://cloudflare.com) with R2 + Hyperdrive enabled
- [PlanetScale](https://planetscale.com) Postgres database (free tier works)
- [Clerk](https://clerk.com) account (free tier works)
- [OpenRouter](https://openrouter.ai) account for AI parsing

### Installation

```bash
# Clone the repository
git clone https://github.com/divkix/clickfolio.me.git
cd clickfolio.me

# Install dependencies
pnpm install

# Copy environment template and fill in your values
cp .env.example .dev.vars

# Apply database migrations (needs DATABASE_URL from PlanetScale)
DATABASE_URL="postgres://…" pnpm run db:migrate

# Start development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Self-Hosting Guide

### Beginner-Friendly Deployment (copy/paste)

If you are not technical, follow this exact checklist. You only need a terminal and browser.

**What you need**

- A Cloudflare account (free is fine)
- A PlanetScale account (Postgres database, free tier is fine)
- A Clerk account (authentication, free tier is fine)
- An OpenRouter account (for AI parsing)
- pnpm installed (copy/paste this in Terminal):
  ```bash
  npm install -g pnpm
  ```

**Step 0: Get the code**

1. Download the repo ZIP from GitHub and unzip it, **or** use:
   ```bash
   git clone https://github.com/divkix/clickfolio.me.git
   cd clickfolio.me
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```

**Step 1: Create the PlanetScale Postgres database**

1. Create a Postgres database in the PlanetScale console (e.g. `clickfolio`).
2. Copy the direct connection string (PlanetScale console → your database → Connect → Postgres URL).
3. You will use it as `DATABASE_URL` below. Note: drizzle-kit uses this DIRECT URL; the deployed Worker connects through Cloudflare Hyperdrive instead.

**Step 2: Create the Cloudflare Hyperdrive binding**

1. In Terminal:
   ```bash
   pnpm exec wrangler hyperdrive create clickfolio-pg --connection-string="postgres://user:password@host/db"
   ```
2. Copy the printed Hyperdrive `id`.
3. Open `wrangler.jsonc` and put that id under `hyperdrive[0].id`.

**Step 3: Create Cloudflare R2 bucket**

1. Go to Cloudflare Dashboard → R2 → Create bucket.
2. Name it **`clickfolio-bucket`**.
3. The bucket is accessed via binding in wrangler.jsonc - no API tokens needed.

**Step 4: Configure R2 CORS**
In Cloudflare R2 bucket settings → CORS, paste:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

**Step 5: Set up Clerk**

1. Create an application at [clerk.com](https://clerk.com) → copy the **Publishable key** (`pk_…`) and **Secret key** (`sk_…`).
2. Enable the Google social connection in Clerk's dashboard (Clerk hosts the OAuth app — no separate Google Cloud project needed).
3. Create a webhook in Clerk → Webhooks pointing to `https://your-domain.com/api/webhooks/clerk`, subscribing to `user.created`, `user.updated`, `user.deleted`. Copy the **signing secret** (`whsec_…`).

**Step 6: Set up OpenRouter**

1. Create OpenRouter account → API Keys.
2. Copy your API key.

**Step 7: Add secrets to Cloudflare (production)**
Run each command and paste the value when prompted:

```bash
pnpm exec wrangler secret put CLERK_SECRET_KEY                 # sk_… from Clerk
pnpm exec wrangler secret put CLERK_WEBHOOK_SECRET             # whsec_… from Clerk webhook
openssl rand -base64 32                                        # then:
pnpm exec wrangler secret put PENDING_UPLOAD_SECRET            # random value from openssl above
pnpm exec wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
pnpm exec wrangler secret put CF_AI_GATEWAY_ID
pnpm exec wrangler secret put CF_AIG_AUTH_TOKEN
```

Set the public values in `wrangler.jsonc` → `vars`, not as secrets:

- `CLERK_PUBLISHABLE_KEY` = your Clerk publishable key (`pk_…`)
- `UMAMI_WEBSITE_ID` = your Umami website id (public; the tracker script prints it)
- `APP_URL` = `https://your-domain.com`

**Step 8: Deploy**

```bash
DATABASE_URL="postgres://…" pnpm run deploy
```

Deploy builds, migrates, backfills NULL `content_indexable` flags, applies R2 lifecycle
rules, and deploys the Worker. It then backfills rows updated since deploy start
minus one hour and queues static URLs from the live sitemap for durable IndexNow delivery.

Production deploys automatically on pushes to `main` through the Cloudflare **Workers Builds**
trigger **Deploy default branch** (`pnpm run build`, then `pnpm run deploy`), not a GitHub
Actions deployment workflow. `.github/workflows/ci.yml` independently checks PRs and `main`
with quality, coverage and build jobs. Non-main branches upload preview versions only.

**IndexNow delivery:** Runtime publish/edit/privacy/rename/delete hooks and the post-deploy
script share the Postgres `indexnow_urls` outbox (migration `0015_indexnow-outbox.sql`).
The minute cron coalesces duplicate URLs across colos/deploys, claims a global sender lease,
and sends at most 1,000 URLs per batch with at least one minute between requests. Ordinary
changes inside the ten-minute per-URL window stay queued for a trailing submission; removals
and renames bypass that URL delay, never the site-wide throttle or upstream cooldown.
Requests only enqueue: no request or Workflow waits for a retry timer.

Only HTTP 200/202 acknowledges the submitted revision. Changes arriving during a send,
overflow batches, crashes, network errors and HTTP refusals remain pending. 429/408/5xx and
transport errors back off from ten minutes exponentially up to 24 hours; a valid
`Retry-After` (seconds or HTTP date) can extend the shared cooldown. Other refusals retain
the batch and retry daily so a repaired key/configuration can recover without another edit.
Failed sends still fail the cron invocation rather than appearing successful. A failed DB
enqueue is logged and cannot be made durable; the originating profile write/deploy is not
rolled back. No per-isolate cache is used as the source of truth.

IndexNow [documents 429](https://www.indexnow.org/documentation) as rate limiting and
[recommends pausing for Retry-After, reducing duplicate submissions and spacing same-URL
retries by ten minutes](https://www.indexnow.org/faq). Exact provider quotas are not public;
the batch and timing limits above are our conservative policy, not a claimed API quota.

**Step 9: Add your domain**
Cloudflare Dashboard → Workers & Pages → your worker → Settings → Domains & Routes.

**Important:** After the domain is connected, update `wrangler.jsonc` → `vars` and redeploy:

- `APP_URL` = `https://your-domain.com`
- Point the Clerk webhook endpoint URL at `https://your-domain.com/api/webhooks/clerk`

**Email notifications:** Permanent resume parse failures and unresolved cache waits
send a dashboard link to the owner's verified Clerk account email. Email delivery is
best effort and never blocks the resume status update. Successful parses do not email.
Use a Workers Paid plan and onboard your sending domain under Cloudflare Dashboard →
Compute → Email Service → Email Sending → Onboard Domain. Set `EMAIL_FROM` and the
`EMAIL` binding's `allowed_sender_addresses` in `wrangler.jsonc` to your sender
(default: `notifications@clickfolio.me`). No email API key is needed.
See [Cloudflare's sending setup](https://developers.cloudflare.com/email-service/get-started/send-emails/).

Local email sends are simulated. Adding `remote: true` to the `EMAIL` binding sends
real mail during development; only enable it for deliberate delivery testing.
Cloudflare Email Sending is currently beta. Email runs in its own journaled workflow
step with automatic retries disabled: normal replay reuses the completed step,
but a crash after provider acceptance and before persistence can still duplicate a
notification. Delivery errors are logged, without recipient addresses, and are not retried.

Then redeploy:

```bash
pnpm run deploy
```

If you followed the steps above, the site should be live at your domain.

### Step 1: Cloudflare Setup

1. **Create a Cloudflare account** at [cloudflare.com](https://cloudflare.com)

2. **Create the Hyperdrive binding** over your PlanetScale Postgres:

   ```bash
   pnpm exec wrangler hyperdrive create clickfolio-pg --connection-string="postgres://…"
   ```

   Copy the `id` to `wrangler.jsonc`

3. **Create R2 Bucket**
   - Go to Cloudflare Dashboard > R2
   - Create bucket named `clickfolio-bucket`
   - The bucket is accessed via binding in `wrangler.jsonc` - no API tokens needed

4. **Configure R2 CORS**
   Add CORS policy in R2 bucket settings:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

### Step 2: Clerk Setup

1. Create an application at [clerk.com](https://clerk.com)
2. Copy the Publishable key (`pk_…`) and Secret key (`sk_…`)
3. Enable Google sign-in in Clerk's dashboard (Clerk manages the OAuth app)
4. Add a webhook endpoint `https://your-domain.com/api/webhooks/clerk` subscribed to `user.created`, `user.updated`, `user.deleted`; copy its signing secret (`whsec_…`)

### Step 3: OpenRouter + Cloudflare AI Gateway (required)

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Go to **API Keys**
3. Create new API key and copy it
4. Get your OpenRouter HTTP Referer and App Title from the dashboard

**Cloudflare AI Gateway**
This project uses Cloudflare AI Gateway for AI calls.

1. Go to Cloudflare Dashboard > AI > AI Gateway
2. Create a gateway
3. Store your OpenRouter token in Cloudflare Secrets Store
4. You will use `CF_AI_GATEWAY_*` environment variables

### Step 4: Environment Variables

Create `.dev.vars` for development:

```bash
# Generate a secure secret with: openssl rand -base64 32

APP_URL=http://localhost:3000
PENDING_UPLOAD_SECRET=your-generated-secret

CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
CLERK_WEBHOOK_SECRET=whsec_…

# Direct PlanetScale URL — used ONLY by drizzle-kit locally (db:migrate/push/studio).
# The dev Worker itself connects through the local Hyperdrive simulation.
DATABASE_URL=postgres://user:password@host/clickfolio

# Cloudflare AI Gateway (BYOK - OpenRouter key stored in CF Secrets Store)
CF_AI_GATEWAY_ACCOUNT_ID=your-account-id
CF_AI_GATEWAY_ID=your-gateway-id
CF_AIG_AUTH_TOKEN=your-gateway-auth-token
```

See `.env.example` for complete template with all options.

### Step 5: Deploy to Cloudflare

1. **Apply database migrations**

   ```bash
   DATABASE_URL="postgres://…" pnpm run db:migrate
   ```

2. **Set production secrets** (see Step 7 of the beginner guide above)

3. **Deploy**

   ```bash
   DATABASE_URL="postgres://…" pnpm run deploy
   ```

4. **Configure custom domain** (optional)
   - In Cloudflare Dashboard > Workers & Pages > Your Worker
   - Add custom domain in Settings > Domains & Routes

---

## Development

### Available Scripts

```bash
# Development
pnpm run dev              # Start dev server at localhost:3000
pnpm run lint             # Oxlint linting (via vp lint)
pnpm run fix              # Oxlint + Oxfmt auto-fix (via vp check --fix)
pnpm run type-check       # TypeScript check

# Build & Deploy
pnpm run build            # Vite production build (TanStack Start + Cloudflare plugin)
pnpm run preview          # Local Cloudflare preview
pnpm run deploy           # build → migrate → NULL backfill → R2 lifecycle → deploy → since backfill → IndexNow (needs DATABASE_URL)

# Database (PlanetScale Postgres via drizzle-kit; needs DATABASE_URL except generate)
pnpm run db:generate      # Generate migration files into migrations_pg/
pnpm run db:migrate       # Apply migrations_pg/ to DATABASE_URL
pnpm run db:push          # Sync schema without migration files (prototyping only)
pnpm run db:studio        # Drizzle Studio UI (port 4984)

# Testing
pnpm run test             # Integration and security tests
pnpm run test:integration # Integration tests
pnpm run test:security    # Security tests
pnpm run test:coverage    # All tests + coverage
pnpm run test:ci          # CI mode (JSON reporter)
pnpm run test:ui          # Interactive UI mode

# Quality
pnpm run verify           # check + type-check + knip
pnpm run format           # Format with Oxfmt
pnpm run seo:lastmod      # Update SEO last-modified timestamps
pnpm run ci               # type-check + lint + test + build
```

Tests cover integration and security flows. CI collects coverage (including
`worker/`) and enforces the measured floors in `vite.config.ts`
(`test.coverage.thresholds`).

### Dependency Updates

Dependabot checks weekly (Monday 09:00 UTC) with a 7-day cooldown, so a
just-published release waits a week before it is proposed (security updates skip
the cooldown). Vite+ toolchain packages (`vite-plus`, the `vite` catalog alias,
`vitest`, `@vitest/*`, `@voidzero-dev/*`) are grouped into one minor/patch PR
because they only move in lockstep. Other patches arrive as one grouped PR;
minors and majors get one PR per package. GitHub Actions updates are grouped.

Nothing merges automatically: the owner reads each PR's changelog, migrates code
where needed and merges by hand.

### Project Structure

```
app/
├── routes/              # TanStack Router file routes (routeTree.gen.ts is generated)
│   ├── api/             # Server routes (webhooks/clerk, upload, resume, etc.)
│   ├── admin/           # Admin dashboard (route.tsx gates; users, resumes, analytics)
│   ├── _protected/      # Auth-gated pages: dashboard, edit, settings, themes, waiting, wizard
│   ├── @{$handle}.tsx   # Public resume viewer /@handle
│   ├── for/             # Landing pages by profession
│   ├── blog/            # Blog posts & content marketing
│   ├── preview/         # Template preview (demo data)
│   ├── index.tsx        # Homepage
│   └── __root.tsx       # Root document (ClerkProvider, head, scripts)
├── router.tsx           # Router factory (error/not-found defaults)
├── client.tsx           # Client entry (hydration + browser telemetry)
└── globals.css          # Global styles

components/
├── templates/           # Resume template components
├── ui/                  # shadcn/ui components
├── auth/                # LoginButton using Clerk's native sign-in modal
├── dashboard/           # Dashboard-specific components
├── icons/               # Custom icon components
├── analytics/           # Analytics components
└── *.tsx                # Shared components (Footer, Logo, etc.)

lib/
├── auth/                # Clerk integration (server JWKS verification, session, client seam)
├── ai/                  # AI parsing (OpenRouter via CF AI Gateway)
├── cron/                # Daily DB cleanup, 15-minute stranded-resume sweep
├── db/                  # Drizzle PG schema + getDb(env.HYPERDRIVE)
├── durable-objects/     # WebSocket Durable Object
├── parse/               # Parse step bodies, error classification, alerts, DO notify
├── workflows/           # ResumeParseWorkflow + R2DeleteWorkflow and their triggers
├── schemas/             # Zod validation schemas
├── templates/           # Theme registry & metadata
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── blog/                # Blog post data
└── config/              # Site config, FAQ, retry policies

worker/
├── index.ts             # Worker entry (TanStack Start handler + Workflows + Cron + Queue + WebSocket auth)
└── cached-pages.ts      # CachedPages entrypoint: Workers Cache for public pages + purges

migrations_pg/
└── *.sql                # Postgres migrations (drizzle-kit)

tests/
├── integration/         # Integration tests
├── security/            # Security tests (IDOR, rate limits)
└── helpers/             # Shared fixtures, including PGlite; tests use native Node WebCrypto
```

---

## Architecture

### The Claim Check Pattern

Allows anonymous users to upload before authenticating:

```
1. POST /api/upload         → Upload file directly to Worker
2. Worker stores in R2      → Signed pending_upload cookie (HMAC'd with PENDING_UPLOAD_SECRET)
3. User authenticates       → Clerk (Google OAuth or credentials)
4. POST /api/resume/claim   → Link upload to user, trigger parsing
5. Poll /api/resume/status  → Wait for AI parsing (~30-40s)
```

### Privacy Filtering

Before rendering public profiles:

- Phone numbers: Hidden by default
- Addresses: City, region or country only (full street address hidden)
- Email: Shown by default; owners can hide it in the wizard or Settings
- User controls visibility in settings

### Real-time Updates (WebSocket)

Live status updates during AI parsing:

- **Endpoint**: `wss://your-domain.com/ws/resume-status?resume_id={id}`
- **Technology**: Cloudflare Durable Objects (`ClickfolioStatusDO`)
- **Flow**: WebSocket connection → DO tracks parsing progress → Real-time status pushed to client
- **Authentication**: Clerk session JWT verified against JWKS before upgrade
- **Use case**: Waiting room shows live parsing progress instead of polling

### Browser telemetry

`/otel/v1/{traces,logs}` forwards bounded browser exports with the server-side ingest key.
The pinned SDK compatibility transform omits undefined session-resource values, null array
members and nonfinite numbers before OTLP serialization; finite integers beyond JavaScript's
safe integer range use `doubleValue`, and split UTF-16 strings are repaired. The proxy applies
the same compatibility rules to plain JSON from cached, older SDK clients at resource, scope,
span, event and link attribute boundaries without changing span timestamps.
An SDK upgrade fails the build until the pinned transform is reviewed.

This matters because [OpenObserve v1.1.2's JSON decoder](https://github.com/openobserve/openobserve/blob/v1.1.2/src/core/src/traces/mod.rs#L614-L632)
rejects a whole export containing `value: {}` or `doubleValue: null`. The bundled SDK can emit
these from its [optional `rum.sessionId` resource getter](https://github.com/hyperdxio/hyperdx-js/blob/566fc3bd2749f281670084a473cdc3d1bbba9aeb/packages/otel-web/src/index.ts#L632-L638)
and [OTLP attribute serializer](https://github.com/open-telemetry/opentelemetry-js/blob/experimental/v0.219.0/experimental/packages/otlp-transformer/src/common/internal.ts#L71-L101).
Both patterns were reproduced as HTTP 400 against the exact v1.1.2 Docker image; the patched
SDK and proxy exports returned 200. Old production logs discarded rejection bodies, so the
specific attribute in each historical batch cannot be recovered.

Collector rejections retain a scrubbed 512-character response prefix (at most 1 KiB buffered)
alongside the signal and HTTP status; credentials, quoted values, URLs and emails are removed.
The browser still receives a prompt 202 and never sees upstream credentials or diagnostics.

OpenObserve v1.1.2 returns [206 for partially rejected spans](https://github.com/openobserve/openobserve/blob/v1.1.2/src/core/src/traces/mod.rs#L1680-L1715),
including spans outside its ingest window, whereas [400 identifies JSON decoding or schema failures](https://github.com/openobserve/openobserve/blob/v1.1.2/src/core/src/traces/mod.rs#L614-L632).
Do not infer clock skew from a 400 or clamp valid timestamps: use the captured upstream reason.

Cloudflare's `canceled` and `responseStreamDisconnected` outcomes on the status WebSocket
mean [the client disconnected](https://developers.cloudflare.com/workers/observability/errors/#identify-errors-workers-metrics),
not an application HTTP failure. The socket closes on component cleanup and reconnects or
falls back to polling when the connection is unexpectedly lost.

### Parse Pipeline (Cloudflare Workflows)

Durable resume parsing with per-step retries:

- **Workflow**: `ResumeParseWorkflow` (`lib/workflows/resume-parse-workflow.ts`) runs `claim → parse → classify career → complete`
- **Trigger**: `/api/resume/claim` and `/api/resume/retry` start an instance keyed by the resume id, so a repeated start is a no-op
- **Retries**: the parse step retries transient failures 3 times with exponential backoff; permanent errors throw `NonRetryableError`
- **Career classification**: Jev's typed [System One endpoint](https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request) runs in its own journaled step, so an overloaded classifier never regenerates the parsed resume. HTTP 429 and retryable server failures (including 529) get two Workflow-owned retries with exponential backoff starting at 5 seconds: at most three requests, each with the existing 10-second abort budget and a 15-second step timeout. Other rejected requests and invalid answers stop immediately.
- **Classification fallback**: missing configuration, non-resumes, or an unavailable classifier after retries do not fail the portfolio. Completion preserves the owner's current professional level, its source, and freelance setting; an unset level stays unset. Owners can set these manually under **Settings → Professional Level**. [Workflow retries and caught step failures](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/) own this policy; no nested fetch retry or [AI SDK retry](https://ai-sdk.dev/docs/ai-sdk-core/settings#maxretries) is added.
- **Failure**: once parse or completion retries are spent the workflow marks the row `failed`, notifies the Durable Object, and sends an alert; classification remains best effort
- **Duplicate uploads**: an `await-cache` instance sleeps 10 minutes, then expires a `waiting_for_cache` row that never resolved
- **Alerting**: Cloudflare Logpush by default, optional Slack/Discord webhook on permanent failures
- **User email**: a separate best-effort `EMAIL` step sends a dashboard link after terminal failure or cache expiry, only to verified Clerk account owners; no automatic email retries

### R2 Cleanup

- **Anonymous uploads**: an R2 lifecycle rule (`r2-lifecycle.json`, applied by `pnpm run deploy`) deletes `temp/` objects after 1 day
- **Deletions**: `R2DeleteWorkflow` retries failed deletes (account deletion, admin dismiss) with backoff

### Scheduled Tasks (Cron)

| Cron           | Time (UTC)       | Task                                                                                                                                    |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `* * * * *`    | Every minute     | Drains due IndexNow outbox submissions; failures stay pending until their persisted retry time                                          |
| `0 3 * * *`    | 3:00 AM          | Database cleanup (expired rate limits, handle history)                                                                                  |
| `*/15 * * * *` | Every 15 minutes | Fails resumes stuck in `pending_claim`/`queued` (over 15 min) or `processing` (over 90 min); the user can retry them from the dashboard |

Runs via `worker/index.ts` without self-fetch (avoids double billing).

The stranded sweep retries only `DbFailed` / `unavailable` with the exact Hyperdrive
`Egress connection severed outside of Hyperdrive` message, once per rule on a fresh
invocation-local connection. Completed rules and their status pushes are not replayed.
Status-guarded updates cannot fail the same row twice, including when a write committed but its
response was lost; only acknowledged `RETURNING` rows receive best-effort status pushes, and
unknown commits can consume a second batch. Timeouts and unrelated database errors are not
retried. Exhausted recovery still fails the scheduled run.

Clients already originate inside each invocation, as required by Cloudflare's
[Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).
Cloudflare's [troubleshooting guide](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/#connection-errors)
documents generic Hyperdrive SQLSTATE `58000`, not this exact message; it does not establish
whether a severed write committed.

---

## Resume Templates

Built-in templates in `components/templates/` (metadata in `THEME_METADATA`, `lib/templates/theme-ids.ts`):

| Template                           | Category     | Description                                                                                                         |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Academic CV**                    | Professional | A scholarly CV with education first, dated appointments and numbered research outputs                               |
| **Bento Grid**                     | Modern       | Flat colour tiles for your current role, a standout result and your full career                                     |
| **Blueprint**                      | Creative     | A cyanotype drawing sheet with grid paper, section callouts and a title block                                       |
| **Boardroom**                      | Professional | A dark executive ledger with a pinned identity column and brass accents                                             |
| **Bold Corporate**                 | Professional | Annual-report layout with a navy sidebar and condensed headings                                                     |
| **Broadsheet**                     | Professional | A newspaper front page: ruled columns, a masthead name and each role set as a story                                 |
| **Case File**                      | Professional | A typed dossier in a manila folder, with each section filed as a lettered exhibit                                   |
| **Classic ATS**                    | Professional | A printable one-column resume sheet that applicant tracking systems parse cleanly                                   |
| **Contact Sheet**                  | Creative     | Film-frame tiles on near-black with grease-pencil orange, built for photographers                                   |
| **DesignFolio**                    | Creative     | Swiss grid on cool grey with a cobalt name block. Project images lead the page.                                     |
| **DevTerminal**                    | Developer    | GitHub-style profile with pinned projects and a commit timeline                                                     |
| **Gallery Wall**                   | Creative     | An exhibition wall with hung works on labels and a printed artist CV below                                          |
| **Glass Morphic**                  | Modern       | Frosted glass panes lit by one window of light, with a reeded-glass insert                                          |
| **Lesson Plan**                    | Creative     | A ruled planner page with binder holes, coloured subject tabs and a sticky note                                     |
| **Liner Notes**                    | Creative     | An album sleeve with the record sliding out and your jobs listed as Side A tracks                                   |
| **Link Stack**                     | Modern       | A link-in-bio page of full-width colour bars, ultramarine to peach, each one a link to tap or a role to open        |
| **Manuscript**                     | Professional | A book spread with a title page, a table of contents and bylines as a bibliography                                  |
| **Media Kit**                      | Modern       | A creator's brand one-sheet: a fuchsia cover, a wordmark wall of who you've worked with and your real results       |
| **Midnight**                       | Modern       | Midnight blue night sky, Garamond headings and a gold star timeline                                                 |
| **Minimalist Editorial** (default) | Professional | Quiet single serif column with dates set in the margin                                                              |
| **Neo Brutalist**                  | Creative     | Loud yellow poster with a giant name, hard shadows and a skills ticker                                              |
| **Open House**                     | Creative     | A real-estate listing sheet: your name on a hanging yard sign, a property-details table and roles filed as listings |
| **Personal Best**                  | Modern       | A track meet: your name painted across the lanes, real marks on an LED board and roles as a results sheet           |
| **Pitch Deck**                     | Modern       | Your resume as a 16:9 founder deck: title slide, one-liner, traction and the ask                                    |
| **Quota**                          | Professional | A sales resume with a closed-won board of the real figures from your highlights and a dated track record            |
| **Reel**                           | Creative     | A film-editing timeline with clip markers, timecode dates and a red playhead                                        |
| **Retro OS**                       | Creative     | A late-90s desktop where every section opens in its own bevelled window                                             |
| **Rounds**                         | Professional | A nurse's ID badge on a lanyard, with licenses first and experience as a shift log                                  |
| **Scrapbook**                      | Creative     | Craft-paper desk with taped index cards, sticky-note skills and a polaroid portrait                                 |
| **Spotlight**                      | Creative     | A dark stage with a hard-edged followspot on your name and a theatre programme of credits                           |
| **The Brief**                      | Professional | A legal brief: a boxed caption header, roman-numeral sections and double-spaced serif paragraphs                    |
| **The Menu**                       | Creative     | A bistro prix-fixe card on a gingham tablecloth, with roles priced in years along dotted leaders                    |
| **Workspace**                      | Modern       | A clean document page with a cover, a properties table and collapsible sections                                     |

All templates receive `content` (ResumeContent) and `profile` props, respect privacy settings, and are mobile-responsive.

---

## Security

- **Application-Level Authorization**: All data access controlled in code
- **Rate Limiting**: 5 resume uploads/day per user, plus IP-based limits (10/hour, 50/day) for anonymous uploads
- **Input Validation**: Zod schemas on all endpoints
- **XSS Protection**: React's default sanitization
- **Encrypted Secrets**: All secrets encrypted in Cloudflare; Clerk session JWTs verified against JWKS on every server request
- **Webhook Signatures**: Clerk webhooks are Svix-signature verified before processing
- **Privacy Controls**: Users control visibility of phone numbers and addresses
- **IP Privacy**: IP addresses SHA-256 hashed before storage (GDPR-friendly)

To report a vulnerability, open a GitHub issue with the "security" label or contact the maintainers directly via the repository's GitHub page.

---

## Contributing

Contributions welcome! See [`AGENTS.md`](AGENTS.md) for the quality gate and repo traps, and [`CODING_STANDARDS.md`](CODING_STANDARDS.md) for what review checks.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Use conventional commits (`feat:`, `fix:`, `docs:`)
4. Run quality checks (`pnpm run ci`)
5. Submit a pull request

---

## Troubleshooting

### Build Fails with TypeScript Errors

```bash
pnpm run type-check  # See all errors
pnpm run build       # Fix errors and rebuild
```

### Auth Redirect Issues / Users Missing After Sign-Up

1. Verify `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` match the same Clerk application
2. Confirm the Clerk webhook points at `/api/webhooks/clerk` and `CLERK_WEBHOOK_SECRET` matches — a missing row is provisioned from Clerk on first sign-in, but profile updates and deletions only arrive through the webhook
3. Clear browser cookies

### Database Connection Failures

1. Verify the Hyperdrive binding id in `wrangler.jsonc` matches `wrangler hyperdrive create` output
2. For `db:*` scripts, confirm `DATABASE_URL` is set to the DIRECT PlanetScale connection string
3. Check PlanetScale console → your database is awake and credentials are valid

### R2 Upload Fails

1. Check R2 CORS includes your domain
2. Verify R2 bucket binding is configured in `wrangler.jsonc`
3. Confirm bucket name in binding matches actual bucket

### Parsing Stuck in "Processing"

1. Verify CF AI Gateway config and OpenRouter BYOK setup
2. Check PDF isn't corrupted
3. Use retry button (max 2 retries)

### "Cannot find module 'fs'"

You're on Cloudflare Workers. Use R2 bindings for file operations.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [TanStack Start](https://tanstack.com/start) - Full-stack React framework on Vite
- [Clerk](https://clerk.com) - Authentication and user management
- [PlanetScale](https://planetscale.com) - Serverless Postgres
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database access
- [Cloudflare](https://cloudflare.com) - Edge infrastructure
- [OpenRouter](https://openrouter.ai) - AI API gateway
- [OpenAI](https://openai.com) - AI inference
- [shadcn/ui](https://ui.shadcn.com) - UI components (built on Radix UI + Tailwind CSS)

---

**Built with TypeScript. Deployed on the edge. Designed for speed.**
