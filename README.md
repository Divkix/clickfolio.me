# webresume.now

**Turn your PDF resume into a hosted web portfolio in under 60 seconds.**

Upload a PDF. AI parses it. Get a shareable link.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020)](https://workers.cloudflare.com/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

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
| **Framework** | [Next.js 15](https://nextjs.org) (App Router) |
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com) |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| **Auth** | [Better Auth](https://better-auth.com) (Google OAuth) |
| **Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible) |
| **AI Parsing** | [Replicate](https://replicate.com) (datalab-to/marker) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) + [Radix UI](https://radix-ui.com) |

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
- **No Native Next.js Image**: Use `<img>` with CSS instead
- **Edge Middleware Limits**: No D1 access in middleware
- **Bundle Size**: Keep dependencies minimal

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+ (package manager)
- [Cloudflare Account](https://cloudflare.com) with R2 and D1 enabled
- [Google Cloud Console](https://console.cloud.google.com) project for OAuth
- [Replicate](https://replicate.com) account for AI parsing

### Installation

```bash
# Clone the repository
git clone https://github.com/divkix/webresume.now.git
cd webresume.now

# Install dependencies
bun install

# Copy environment template
cp .env.example .env.local

# Set up local database
bun run db:migrate

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Self-Hosting Guide

### Step 1: Cloudflare Setup

1. **Create a Cloudflare account** at [cloudflare.com](https://cloudflare.com)

2. **Create D1 Database**
   ```bash
   bunx wrangler d1 create webresume-db
   ```
   Copy the `database_id` to `wrangler.jsonc`

3. **Create R2 Bucket**
   - Go to Cloudflare Dashboard > R2
   - Create bucket named `webresume-uploads`
   - Generate API token with Read & Write permissions
   - Note your Account ID and Access Keys

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

### Step 3: Replicate Setup

1. Create account at [replicate.com](https://replicate.com)
2. Go to **Account Settings > API Tokens**
3. Create new token and copy it

**Optional: Cloudflare AI Gateway (BYOK)**
For enhanced reliability and caching:
1. Go to Cloudflare Dashboard > AI > AI Gateway
2. Create a gateway
3. Store your Replicate token in Cloudflare Secrets Store
4. Use `CF_AI_GATEWAY_*` environment variables

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

R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=webresume-uploads

REPLICATE_API_TOKEN=r8_your-token
REPLICATE_WEBHOOK_SECRET=whsec_your-webhook-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
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
   bunx wrangler secret put BETTER_AUTH_URL
   bunx wrangler secret put GOOGLE_CLIENT_ID
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put R2_ENDPOINT
   bunx wrangler secret put R2_ACCESS_KEY_ID
   bunx wrangler secret put R2_SECRET_ACCESS_KEY
   bunx wrangler secret put R2_BUCKET_NAME
   bunx wrangler secret put REPLICATE_API_TOKEN
   bunx wrangler secret put REPLICATE_WEBHOOK_SECRET
   bunx wrangler secret put NEXT_PUBLIC_APP_URL
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
bun run build            # Next.js production build
bun run build:worker     # OpenNext Cloudflare bundle
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
├── (auth)/              # /api/auth/* - Better Auth handlers
├── (public)/            # / and /[handle] - no auth required
│   ├── page.tsx         # Homepage with upload dropzone
│   └── [handle]/        # Public resume viewer (SSR)
└── (protected)/         # Auth required pages
    ├── dashboard/       # User dashboard
    ├── edit/            # Content editor with auto-save
    ├── settings/        # Privacy toggles, theme selection
    └── waiting/         # AI parsing status polling

components/
├── templates/           # Resume templates (MinimalistEditorial, etc.)
└── ui/                  # Reusable UI components (shadcn/ui)

lib/
├── auth/                # Better Auth configuration
├── db/                  # Drizzle schema and client
├── schemas/             # Zod validation schemas
└── utils/               # Utility functions
```

---

## Architecture

### The Claim Check Pattern

Allows anonymous users to upload before authenticating:

```
1. POST /api/upload/sign    → Get presigned R2 URL
2. Client uploads to R2     → Store temp key in localStorage
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

---

## Resume Templates

Four built-in templates in `components/templates/`:

| Template | Description |
|----------|-------------|
| **MinimalistEditorial** | Serif fonts, editorial aesthetic (default) |
| **NeoBrutalist** | Bold borders, high contrast |
| **GlassMorphic** | Blur effects, dark background |
| **BentoGrid** | Mosaic grid layout |

All templates receive `content` (ResumeContent) and `user` props, respect privacy settings, and are mobile-responsive.

---

## Security

- **Application-Level Authorization**: All data access controlled in code
- **Rate Limiting**: 5 uploads/day, 10 updates/hour per user
- **Input Validation**: Zod schemas on all endpoints
- **XSS Protection**: React's default sanitization
- **Encrypted Secrets**: All secrets encrypted in Cloudflare

See [SECURITY.md](SECURITY.md) for security policy and vulnerability reporting.

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
2. Verify R2 API token has Read & Write permissions
3. Confirm `R2_BUCKET_NAME` matches actual bucket

### Parsing Stuck in "Processing"
1. Verify Replicate API token is valid
2. Check PDF isn't corrupted
3. Use retry button (max 2 retries)
4. Check Replicate dashboard for job status

### "Cannot find module 'fs'"
You're on Cloudflare Workers. Use R2 presigned URLs for file operations.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Next.js](https://nextjs.org) - React framework
- [Better Auth](https://better-auth.com) - Authentication
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database
- [Cloudflare](https://cloudflare.com) - Edge infrastructure
- [Replicate](https://replicate.com) - AI inference
- [Radix UI](https://radix-ui.com) - Accessible components
- [Tailwind CSS](https://tailwindcss.com) - Styling

---

**Built with TypeScript. Deployed on the edge. Designed for speed.**
