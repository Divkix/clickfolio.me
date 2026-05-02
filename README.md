# clickfolio.me

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

| Layer | Technology |
|-------|------------|
| **Framework** | [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js) |
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com) |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| **Auth** | [Better Auth](https://better-auth.com) (Google OAuth) |
| **Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible) |
| **AI Parsing** | [OpenRouter](https://openrouter.ai) via [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) (openai/gpt-oss models) |
| **Styling** | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS 4](https://tailwindcss.com) |

---

## Why Cloudflare Workers?

We chose Cloudflare Workers over traditional hosting for several reasons:

### Performance
- **Edge Computing**: Code runs in 300+ data centers worldwide, closest to your users
- **Cold Start**: ~0ms cold starts vs. 200-500ms on traditional serverless
- **Latency**: Sub-50ms response times globally

### Cost Efficiency
- **Free Tier**: 100,000 requests/day free
- **D1 Database**: 5GB free, built-in SQLite
- **R2 Storage**: 10GB free, no egress fees
- **Total**: A production app can run free for most use cases

### Developer Experience
- **No Container Management**: Just deploy code
- **Automatic Scaling**: From 0 to millions of requests
- **Integrated Stack**: D1, R2, and Workers work seamlessly together

### Trade-offs
- **No `fs` Module**: Must use R2 for file operations
- **No Next.js `<Image />` Component**: Use `<img>` with CSS instead
- **Edge Middleware Limits**: No D1 access in middleware
- **Bundle Size**: Keep dependencies minimal

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+ (package manager)
- [Cloudflare Account](https://cloudflare.com) with R2 and D1 enabled
- [Google Cloud Console](https://console.cloud.google.com) project for OAuth
- [OpenRouter](https://openrouter.ai) account for AI parsing

### Installation

```bash
# Clone the repository
git clone https://github.com/divkix/clickfolio.me.git
cd clickfolio.me

# Install dependencies
bun install

# Copy environment template
cp .env.example .dev.vars

# Set up local database
bun run db:migrate

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Self-Hosting Guide

### Beginner-Friendly Deployment (copy/paste)

If you are not technical, follow this exact checklist. You only need a terminal and browser.

**What you need**
- A Cloudflare account (free is fine)
- A Google Cloud account (for Google Sign-In)
- An OpenRouter account (for AI parsing)
- Bun installed (copy/paste this in Terminal):
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

**Step 0: Get the code**
1. Download the repo ZIP from GitHub and unzip it, **or** use:
   ```bash
   git clone https://github.com/divkix/clickfolio.me.git
   cd clickfolio.me
   ```
2. Install dependencies:
   ```bash
   bun install
   ```

**Step 1: Create Cloudflare D1 database**
1. In Terminal:
   ```bash
   bunx wrangler d1 create clickfolio-db
   ```
2. Copy the `database_id` printed in the terminal.
3. Open `wrangler.jsonc` and replace the `database_id` value.

**Step 2: Create Cloudflare R2 bucket**
1. Go to Cloudflare Dashboard → R2 → Create bucket.
2. Name it **`clickfolio-bucket`**.
3. The bucket is accessed via binding in wrangler.jsonc - no API tokens needed.

**Step 3: Configure R2 CORS**
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

**Step 4: Set up Google OAuth**
1. Go to Google Cloud Console.
2. Create project → APIs & Services → Credentials.
3. Create OAuth Client ID (Web app).
4. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`
5. Copy **Client ID** and **Client Secret**.

**Step 5: Set up OpenRouter**
1. Create OpenRouter account → API Keys.
2. Copy your API key.

**Step 6: Add secrets to Cloudflare (production)**
Run each command and paste the value when prompted:
```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put BETTER_AUTH_URL              # Also used as app URL
bunx wrangler secret put GOOGLE_CLIENT_ID
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
bunx wrangler secret put CF_AI_GATEWAY_ID
bunx wrangler secret put CF_AIG_AUTH_TOKEN
```

**Step 7: Deploy**
```bash
bun run db:migrate:prod
bun run deploy
```

**Step 8: Add your domain**
Cloudflare Dashboard → Workers & Pages → your worker → Settings → Domains & Routes.

**Important:** After domain is connected, **update this secret**:
- `BETTER_AUTH_URL` = `https://your-domain.com`

Then redeploy:
```bash
bun run deploy
```

If you followed the steps above, the site should be live at your domain.

### Step 1: Cloudflare Setup

1. **Create a Cloudflare account** at [cloudflare.com](https://cloudflare.com)

2. **Create D1 Database**
   ```bash
   bunx wrangler d1 create clickfolio-db
   ```
   Copy the `database_id` to `wrangler.jsonc`

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

### Step 2: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable **Google+ API** and **People API**
4. Go to **APIs & Services > Credentials**
5. Create **OAuth 2.0 Client ID** (Web application type)
6. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
7. Copy Client ID and Client Secret

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

Create `.env.local` for development:

```bash
# Generate a secure secret
openssl rand -base64 32

# Copy to .env.local
BETTER_AUTH_SECRET=your-generated-secret
BETTER_AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Cloudflare AI Gateway (BYOK - OpenRouter key stored in CF Secrets Store)
CF_AI_GATEWAY_ACCOUNT_ID=your-account-id
CF_AI_GATEWAY_ID=your-gateway-id
CF_AIG_AUTH_TOKEN=your-gateway-auth-token

```

See `.env.example` for complete template with all options.

### Step 5: Deploy to Cloudflare

1. **Apply database migrations**
   ```bash
   bun run db:migrate:prod
   ```

2. **Set production secrets**
   ```bash
   bunx wrangler secret put BETTER_AUTH_SECRET
   bunx wrangler secret put BETTER_AUTH_URL              # Also used as app URL
   bunx wrangler secret put GOOGLE_CLIENT_ID
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
   bunx wrangler secret put CF_AI_GATEWAY_ID
   bunx wrangler secret put CF_AIG_AUTH_TOKEN
   ```

3. **Deploy**
   ```bash
   bun run deploy
   ```

4. **Configure custom domain** (optional)
   - In Cloudflare Dashboard > Workers & Pages > Your Worker
   - Add custom domain in Settings > Domains & Routes

---

## Development

### Available Scripts

```bash
# Development
bun run dev              # Start dev server at localhost:3000
bun run lint             # Biome linting
bun run fix              # Biome auto-fix
bun run type-check       # TypeScript check

# Build & Deploy
bun run build            # Vite production build (vinext)
bun run build:worker     # Alias for build
bun run preview          # Local Cloudflare preview
bun run deploy           # Build and deploy to Cloudflare Workers

# Database (D1 + Drizzle)
bun run db:generate      # Generate migrations from schema
bun run db:migrate       # Apply migrations locally
bun run db:migrate:prod  # Apply migrations to production
bun run db:studio        # Drizzle Studio UI (port 4984)
bun run db:reset         # Wipe local D1 and re-migrate

# Quality
bun run ci               # type-check + lint + build
```

### Project Structure

```
app/
├── api/                 # API routes (auth, upload, resume, etc.)
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
├── (public)/            # Public pages requiring no auth
│   └── verify-email/    # Email verification page
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
├── layout.tsx           # Root layout
└── globals.css          # Global styles

components/
├── templates/           # 10 resume template components
├── ui/                  # shadcn/ui components
├── dashboard/           # Dashboard-specific components
├── icons/               # Custom icon components
├── analytics/           # Analytics components
└── *.tsx                # Shared components (Footer, Logo, etc.)

lib/
├── auth/                # Better Auth configuration
├── ai/                  # AI parsing (OpenRouter via CF AI Gateway)
├── cron/                # Scheduled task implementations
├── db/                  # Drizzle schema, client, migrations
├── durable-objects/     # WebSocket Durable Object
├── email/               # Email service (CF Email)
├── queue/               # Queue consumer, types, DLQ
├── schemas/             # Zod validation schemas
├── templates/           # Theme registry & metadata
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── blog/                # Blog post data
└── config/              # Site config, FAQ, retry policies

worker/
└── index.ts             # Custom worker entry (vinext + Queue + Cron)

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
2. Worker stores in R2      → Store temp key in localStorage
3. User authenticates       → Google OAuth
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
- **Authentication**: Session token validated before upgrade
- **Use case**: Waiting room shows live parsing progress instead of polling

### Queue System

Asynchronous resume parsing pipeline:
- **Queue**: `clickfolio-parse-queue` (Cloudflare Queues)
- **DLQ**: `clickfolio-parse-dlq` for failed messages
- **Producer**: `/api/resume/claim` enqueues after upload
- **Consumer**: `worker/index.ts` processes in background
- **Retry**: 3 automatic retries with exponential backoff
- **Alerting**: Optional Slack/Discord/email on permanent failures

### Scheduled Tasks (Cron)

Four cron triggers run automatically:

| Cron | Time (UTC) | Task |
|------|-----------|------|
| `0 2 * * *` | 2:00 AM | R2 temp file cleanup (old uploads) |
| `0 3 * * *` | 3:00 AM | Database cleanup (expired sessions) |
| `0 4 * * *` | 4:00 AM | Sync disposable email domain blocklist |
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

| Template | Category | Description | Unlock Requirement |
|----------|----------|-------------|-------------------|
| **Minimalist Editorial** | Professional | Clean magazine-style layout with serif typography | Free (default) |
| **Neo Brutalist** | Creative | Bold design with thick borders and loud colors | Free |
| **Glass Morphic** | Modern | Dark theme with frosted glass effects | Free |
| **Bento Grid** | Modern | Modern mosaic layout with colorful cards | Free |
| **Classic ATS** | Professional | Legal brief typography, ATS-optimized single-column layout | Free |
| **DevTerminal** | Developer | GitHub-inspired dark terminal aesthetic for developers | Free |
| **DesignFolio** | Creative | Digital brutalism meets Swiss typography with acid lime accents | 3 referrals |
| **Spotlight** | Creative | Warm creative portfolio with animated sections | 3 referrals |
| **Midnight** | Modern | Dark minimal with serif headings and gold accents | 5 referrals |
| **Bold Corporate** | Professional | Executive typography with bold numbered sections | 10 referrals |

All templates receive `content` (ResumeContent) and `user` props, respect privacy settings, and are mobile-responsive. Premium templates unlock through the referral program.

---

## Security

- **Application-Level Authorization**: All data access controlled in code
- **Rate Limiting**: 5 resume uploads/day per user, plus IP-based limits (10/hour, 50/day) for anonymous uploads
- **Input Validation**: Zod schemas on all endpoints
- **XSS Protection**: React's default sanitization
- **Encrypted Secrets**: All secrets encrypted in Cloudflare
- **Privacy Controls**: Users control visibility of phone numbers and addresses
- **IP Privacy**: IP addresses SHA-256 hashed before storage (GDPR-friendly)

See [SECURITY.md](SECURITY.md) for detailed security policy, rate limiting details, and vulnerability reporting.

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Use conventional commits (`feat:`, `fix:`, `docs:`)
4. Run quality checks (`bun run ci`)
5. Submit a pull request

---

## Troubleshooting

### Build Fails with TypeScript Errors
```bash
bun run type-check  # See all errors
bun run build       # Fix errors and rebuild
```

### OAuth Redirect Loop
1. Verify `BETTER_AUTH_URL` includes `https://` for production
2. Check redirect URIs match in Google Cloud Console
3. Clear browser cookies

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
- [Better Auth](https://better-auth.com) - Authentication
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database
- [Cloudflare](https://cloudflare.com) - Edge infrastructure
- [OpenRouter](https://openrouter.ai) - AI API gateway
- [OpenAI](https://openai.com) - AI inference
- [shadcn/ui](https://ui.shadcn.com) - UI components (built on Radix UI + Tailwind CSS)

---

**Built with TypeScript. Deployed on the edge. Designed for speed.**
