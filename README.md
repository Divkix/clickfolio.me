# clickfolio.me

<img width="1624" height="964" alt="Screenshot 2026-06-16 at 4 35 36 PM" src="https://github.com/user-attachments/assets/c2075f44-b11d-4b20-bbe8-68652ebb7f53" />

**Turn your PDF resume into a hosted web portfolio in under 60 seconds.**

Upload a PDF. AI parses it. Get a shareable link.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020)](https://workers.cloudflare.com/)
[![vinext](https://img.shields.io/npm/v/vinext?label=vinext&color=blue)](https://github.com/cloudflare/vinext)

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

| Layer          | Technology                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js)                                                                                                  |
| **Runtime**    | [Cloudflare Workers](https://workers.cloudflare.com)                                                                                                                 |
| **Database**   | [PlanetScale Postgres](https://planetscale.com) via [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) + [Drizzle ORM](https://orm.drizzle.team) |
| **Auth**       | [Clerk](https://clerk.com) (Google OAuth + credentials; prebuilt `<SignIn>/<SignUp>` UI, JWKS-verified session JWTs)                                                 |
| **Storage**    | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible)                                                                                               |
| **AI Parsing** | [OpenRouter](https://openrouter.ai) via [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) (openai/gpt-oss models)                               |
| **Styling**    | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS 4](https://tailwindcss.com)                                                                                       |

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
- **Integrated Stack**: Hyperdrive, R2, Queues, and Durable Objects work seamlessly together

### Trade-offs

- **No `fs` Module**: Must use R2 for file operations
- **No Next.js `<Image />` Component**: Use `<img>` with CSS instead
- **No DB in Middleware**: The edge proxy only checks cookie presence
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
pnpm exec wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY # pk_… from Clerk
pnpm exec wrangler secret put APP_URL                          # https://your-domain.com
openssl rand -base64 32                                        # then:
pnpm exec wrangler secret put PENDING_UPLOAD_SECRET            # random value from openssl above
pnpm exec wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
pnpm exec wrangler secret put CF_AI_GATEWAY_ID
pnpm exec wrangler secret put CF_AIG_AUTH_TOKEN
```

**Step 8: Deploy**

```bash
DATABASE_URL="postgres://…" pnpm run db:migrate   # apply migrations_pg/ to production
pnpm run deploy
```

**Step 9: Add your domain**
Cloudflare Dashboard → Workers & Pages → your worker → Settings → Domains & Routes.

**Important:** After domain is connected, update these secrets and redeploy:

- `APP_URL` = `https://your-domain.com`
- Point the Clerk webhook endpoint URL at `https://your-domain.com/api/webhooks/clerk`

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

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
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
   pnpm run deploy
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
pnpm run build            # Vite production build (vinext)
pnpm run preview          # Local Cloudflare preview
pnpm run deploy           # Thin wrapper around `wrangler deploy` (no build step)

# Database (PlanetScale Postgres via drizzle-kit; needs DATABASE_URL except generate)
pnpm run db:generate      # Generate migration files into migrations_pg/
pnpm run db:migrate       # Apply migrations_pg/ to DATABASE_URL
pnpm run db:push          # Sync schema without migration files (prototyping only)
pnpm run db:studio        # Drizzle Studio UI (port 4984)

# Testing
pnpm run test             # All tests
pnpm run test:unit        # Unit tests (fast, no retries)
pnpm run test:integration # Integration tests
pnpm run test:security    # Security tests
pnpm run test:coverage    # All tests + coverage
pnpm run test:ci          # CI mode (JSON reporter)
pnpm run test:ui          # Interactive UI mode

# Quality
pnpm run ci               # type-check + lint + test + build
```

### Project Structure

```
app/
├── api/                 # API routes (webhooks/clerk, upload, resume, etc.)
├── (admin)/             # Admin dashboard pages
│   ├── admin/
│   │   ├── users/       # User management
│   │   ├── referrals/   # Referral analytics
│   │   ├── resumes/     # Resume management
│   │   └── analytics/   # Site analytics
│   └── layout-client.tsx # Admin layout wrapper
├── (protected)/         # Auth-gated pages
│   ├── dashboard/       # User dashboard with analytics
│   ├── edit/            # Resume content editor
│   ├── settings/        # Privacy & theme settings
│   ├── themes/          # Theme gallery
│   ├── waiting/         # AI parsing status (WebSocket)
│   └── wizard/          # Onboarding wizard
├── [handle]/            # Public resume viewer /@handle
├── for/                 # Landing pages by profession
│   ├── student/
│   ├── software-engineer/
│   ├── designer/
│   ├── product-manager/
│   ├── marketer/
│   └── consultant/
├── blog/                # Blog posts & content marketing
├── preview/[id]/        # Template preview (before claiming)
├── page.tsx             # Homepage
├── layout.tsx           # Root layout (ClerkProvider wrapper)
└── globals.css          # Global styles

components/
├── templates/           # 10 resume template components
├── ui/                  # shadcn/ui components
├── auth/                # LoginButton using Clerk's native sign-in modal
├── dashboard/           # Dashboard-specific components
├── icons/               # Custom icon components
├── analytics/           # Analytics components
└── *.tsx                # Shared components (Footer, Logo, etc.)

lib/
├── auth/                # Clerk integration (server JWKS verification, session, client seam)
├── ai/                  # AI parsing (OpenRouter via CF AI Gateway)
├── cron/                # Scheduled task implementations
├── db/                  # Drizzle PG schema + getDb(env.HYPERDRIVE)
├── durable-objects/     # WebSocket Durable Object
├── email/               # Disposable-domain check
├── queue/               # Queue consumer, types, DLQ
├── schemas/             # Zod validation schemas
├── templates/           # Theme registry & metadata
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── blog/                # Blog post data
└── config/              # Site config, FAQ, retry policies

worker/
└── index.ts             # Custom worker entry (vinext + Queue + Cron + WebSocket auth)

migrations_pg/
└── *.sql                # Postgres migrations (drizzle-kit)

__tests__/
├── unit/                # Unit tests
├── integration/         # Integration tests
├── security/            # Security tests (IDOR, rate limits)
└── setup.ts             # Test configuration
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
- Addresses: City/State only (full address hidden)
- Email: Public (for contact)
- User controls visibility in settings

### Real-time Updates (WebSocket)

Live status updates during AI parsing:

- **Endpoint**: `wss://your-domain.com/ws/resume-status?resume_id={id}`
- **Technology**: Cloudflare Durable Objects (`ClickfolioStatusDO`)
- **Flow**: WebSocket connection → DO tracks parsing progress → Real-time status pushed to client
- **Authentication**: Clerk session JWT verified against JWKS before upgrade
- **Use case**: Waiting room shows live parsing progress instead of polling

### Queue System

Asynchronous resume parsing pipeline:

- **Queue**: `clickfolio-parse-queue` (Cloudflare Queues)
- **DLQ**: `clickfolio-parse-dlq` for failed messages
- **Producer**: `/api/resume/claim` enqueues after upload
- **Consumer**: `worker/index.ts` processes in background
- **Retry**: 3 automatic retries with exponential backoff
- **Alerting**: Cloudflare Logpush by default, optional Slack/Discord webhook on permanent failures

### Scheduled Tasks (Cron)

Four cron triggers run automatically:

| Cron           | Time (UTC)   | Task                                        |
| -------------- | ------------ | ------------------------------------------- |
| `0 2 * * *`    | 2:00 AM      | R2 temp file cleanup (old uploads)          |
| `0 3 * * *`    | 3:00 AM      | Database cleanup (expired rate limits)      |
| `0 4 * * *`    | 4:00 AM      | Sync disposable email domain blocklist      |
| `*/15 * * * *` | Every 15 min | Recover orphaned resumes (stuck in parsing) |

All run via `worker/index.ts` without self-fetch (avoids double billing).

### Referral Program

Unlock premium templates by sharing:

- **Mechanism**: Share your unique referral link from dashboard
- **Tracking**: Friend signs up → your referral count increases
- **Unlocks**:
  - 3 referrals: DesignFolio, Spotlight templates
  - 5 referrals: Midnight template
  - 10 referrals: Bold Corporate template
- **View**: Dashboard shows current count and progress to next unlock

---

## Resume Templates

10 built-in templates in `components/templates/`:

| Template                 | Category     | Description                                                     | Unlock Requirement |
| ------------------------ | ------------ | --------------------------------------------------------------- | ------------------ |
| **Minimalist Editorial** | Professional | Clean magazine-style layout with serif typography               | Free (default)     |
| **Neo Brutalist**        | Creative     | Bold design with thick borders and loud colors                  | Free               |
| **Glass Morphic**        | Modern       | Dark theme with frosted glass effects                           | Free               |
| **Bento Grid**           | Modern       | Modern mosaic layout with colorful cards                        | Free               |
| **Classic ATS**          | Professional | Legal brief typography, ATS-optimized single-column layout      | Free               |
| **DevTerminal**          | Developer    | GitHub-inspired dark terminal aesthetic for developers          | Free               |
| **DesignFolio**          | Creative     | Digital brutalism meets Swiss typography with acid lime accents | 3 referrals        |
| **Spotlight**            | Creative     | Warm creative portfolio with animated sections                  | 3 referrals        |
| **Midnight**             | Modern       | Dark minimal with serif headings and gold accents               | 5 referrals        |
| **Bold Corporate**       | Professional | Executive typography with bold numbered sections                | 10 referrals       |

All templates receive `content` (ResumeContent) and `profile` props, respect privacy settings, and are mobile-responsive. Premium templates unlock through the referral program.

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

Contributions welcome! See [`AGENTS.md`](AGENTS.md) for branch conventions, commit style, and the `pnpm run ci` quality gate.

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

1. Verify `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` match the same Clerk application
2. Confirm the Clerk webhook points at `/api/webhooks/clerk` and `CLERK_WEBHOOK_SECRET` matches — a signed-in user with no synced row gets 404s until the webhook lands
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

- [vinext](https://github.com/cloudflare/vinext) - Vite-based Next.js for Cloudflare Workers
- [Clerk](https://clerk.com) - Authentication and user management
- [PlanetScale](https://planetscale.com) - Serverless Postgres
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database access
- [Cloudflare](https://cloudflare.com) - Edge infrastructure
- [OpenRouter](https://openrouter.ai) - AI API gateway
- [OpenAI](https://openai.com) - AI inference
- [shadcn/ui](https://ui.shadcn.com) - UI components (built on Radix UI + Tailwind CSS)

---

**Built with TypeScript. Deployed on the edge. Designed for speed.**
