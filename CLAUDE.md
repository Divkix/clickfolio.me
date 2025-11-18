# webresume.now — AI Development Context

## Project Identity

**Vision**: The fastest way to turn a static résumé into a hosted, shareable web portfolio. "Drop a PDF, get a link."

**Core Loop**: Upload (PDF) → Parse (AI) → Polish (Survey) → Publish (Next.js Edge)

**Target Audience**: Job seekers, students, and career switchers who need a clean URL but hate building websites.

**Success Metrics (MVP)**:
- Conversion: >60% of users who upload complete Google Auth
- Activation: >80% of authenticated users publish a live handle
- TTFIS (Time to First Interactive Site): <60 seconds

---

## Tech Stack & Infrastructure

### Core Technologies
- **Framework**: Next.js 15 (App Router) deployed via `@opennextjs/cloudflare`
- **Runtime**: Cloudflare Workers with Node.js Compatibility Mode
- **Database**: Supabase (Postgres + Auth) — NO Supabase Edge Functions
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI Parsing**: Replicate (datalab-to/marker with structured extraction)
- **Package Manager**: **bun** (NOT npm/yarn/pnpm)

### Deployment Architecture
```
User → Cloudflare Workers (Next.js 15) → Supabase (Postgres + Auth)
                ↓                              ↓
         Cloudflare R2                  Replicate API
```

### Critical Constraints (MUST FOLLOW)

1. **Cloudflare Worker Limitations**:
   - ❌ NO filesystem access (`fs` module unavailable)
   - ❌ NO Next.js `<Image />` component (optimization requires server)
   - ✅ USE presigned URLs for R2 uploads
   - ✅ USE CSS `aspect-ratio` + `object-fit` for images
   - ✅ USE `@aws-sdk/client-s3` for R2 operations

2. **Rendering Strategy**:
   - `/dashboard`: Server-rendered (SSR), protected
   - `/[handle]`: Server-rendered, highly cached (ISR-like via Cache-Control)

3. **Privacy Defaults**:
   - Phone numbers: HIDDEN by default
   - Street addresses: HIDDEN by default (only City/State shown)
   - Email: PUBLIC (uses `mailto:` links)

---

## Architectural Patterns

### 1. The "Claim Check" Pattern (Critical)
Anonymous users can upload files before authentication. The handoff works like this:

```typescript
// 1. Anonymous Upload
POST /api/upload/sign → { uploadUrl, key: "temp/{uuid}/{filename}" }
// Client uploads to R2, stores key in localStorage

// 2. User logs in with Google OAuth

// 3. Claim the upload
POST /api/resume/claim with { key }
// Server moves ownership to authenticated user
// Triggers Replicate parsing
// Returns resume_id
```

**Implementation Rules**:
- Store `temp_upload_id` in `localStorage` immediately after upload
- Clear `localStorage` after successful claim
- R2 key format: `temp/{uuid}/{filename}` → `users/{user_id}/{filename}`

### 2. Structured AI Extraction
We use Replicate's `datalab-to/marker` with a **custom JSON schema** to enforce output structure:

```json
{
  "file": "https://r2.../file.pdf",
  "use_llm": true,
  "page_schema": {
    "type": "object",
    "properties": {
      "full_name": { "type": "string" },
      "headline": { "type": "string", "description": "A 10-word professional summary" },
      "summary": { "type": "string", "maxLength": 500 },
      "contact": { ... },
      "experience": { "type": "array", "items": { ... } }
    }
  }
}
```

**Normalization Rule**: If `experience` has >5 items, slice to top 5. If `summary` >500 chars, truncate.

### 3. Privacy Filtering (ALWAYS Enforce)
Before rendering public pages (`/[handle]`):

```typescript
if (!profile.privacy_settings.show_phone) {
  delete content.contact.phone; // Remove from DOM entirely
}
if (!profile.privacy_settings.show_address) {
  content.contact.location = extractCityState(content.contact.location);
}
```

---

## Data Model (Supabase)

### Schema Overview

**profiles**
- `id` (uuid, FK to auth.users)
- `handle` (text, unique, min 3 chars)
- `email`, `avatar_url`, `headline`
- `privacy_settings` (jsonb): `{ show_phone: bool, show_address: bool }`

**resumes**
- `id`, `user_id` (FK to profiles)
- `r2_key` (path in bucket)
- `status`: `pending_claim`, `processing`, `completed`, `failed`
- `error_message`, `created_at`

**site_data**
- `id`, `user_id`, `resume_id`
- `content` (jsonb): Render-ready resume JSON
- `theme_id` (default: 'minimalist_creme')
- `last_published_at`

**redirects**
- `old_handle`, `new_handle`
- `expires_at` (handles released after 30 days)

### RLS Policies (Required)
- `profiles`: Public read (handle lookup), user update own
- `resumes`: User read/create own only
- `site_data`: Public read, user update own

---

## Development Guidelines

### Code Standards
- **Spacing**: Use spaces, NOT tabs
- **Commits**: Conventional format with detailed descriptions
  ```
  feat(upload): implement presigned R2 upload with claim check pattern

  - Add POST /api/upload/sign endpoint
  - Generate temp keys with UUID prefix
  - Enforce 10MB limit via content-length-range
  - Store key in localStorage for post-auth claim
  ```
- **Dependencies**: ALWAYS use `bun install`, `bun add`, `bun run`
- **Documentation**: ALWAYS use context7 MCP for library docs

### Phase-Based Vertical Slicing (STRICT)
**DO NOT skip phases. Deploy and verify each phase before proceeding.**

**Phase 1: Skeleton & Plumbing** (Days 1-3)
- Initialize Next.js 15 + OpenNext Cloudflare adapter
- Configure Supabase (tables + RLS + Google OAuth)
- Deploy to Cloudflare Workers
- ✅ Checkpoint: Login/Logout works on live URL

**Phase 2: Drop & Claim Loop** (Days 4-6)
- Create R2 bucket + CORS config
- Implement presigned upload API
- Build FileDropzone component + localStorage logic
- Create claim API (links upload to user)
- ✅ Checkpoint: Anonymous upload → Auth → DB row created

**Phase 3: The Viewer (Mocked)** (Days 7-9)
- Create `[handle]/page.tsx` dynamic route
- Manually seed `site_data` with test JSON
- Build "Minimalist Crème" template component
- ✅ Checkpoint: `webresume.now/testhandle` renders mock data

**Phase 4: The Brain (AI Integration)** (Days 10-13)
- Integrate Replicate client
- Update claim API to trigger parsing job
- Build polling UI ("Waiting Room")
- Implement normalization layer (Replicate → site_data)
- ✅ Checkpoint: Real PDF → AI parse → Dashboard

**Phase 5: Polish & Launch** (Days 14-15)
- Build edit form (survey UI)
- Add privacy toggles (show_phone, show_address)
- Implement rate limiting (5/24h)
- Add SEO metadata (dynamic titles, OG images)
- ✅ Checkpoint: Full E2E flow works flawlessly

---

## Critical Implementation Rules

### Security & Validation
```typescript
// ALWAYS validate PDF magic number before R2
const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50; // %PDF

// ALWAYS enforce file size in presigned URL
const presignedUrl = await getSignedUrl(s3Client, putCommand, {
  expiresIn: 3600,
  signableHeaders: new Set(['content-length']),
  unhoistableHeaders: new Set(['content-length-range'])
});
```

### Image Handling
```tsx
// ❌ NEVER use Next.js Image component
<Image src="..." alt="..." /> // WRONG - breaks on Cloudflare

// ✅ ALWAYS use standard HTML with CSS
<img
  src={avatarUrl}
  alt="Profile"
  className="rounded-full aspect-square object-cover w-32 h-32"
/>
```

### Storage Patterns
```typescript
// R2 Key Structure
temp/{uuid}/{filename}           // Anonymous uploads
users/{user_id}/{timestamp}/{filename}  // Claimed uploads

// NEVER write to filesystem
fs.writeFileSync('...') // WRONG - not available on Workers
```

### Rate Limiting
```sql
-- Check upload quota in API
SELECT count(*) FROM resumes
WHERE user_id = $1
AND created_at > now() - interval '1 day'
LIMIT 5;
```

---

## File Structure Conventions

```
app/
├── (auth)/
│   └── auth/callback/route.ts      # OAuth callback handler
├── (public)/
│   └── [handle]/page.tsx           # Public resume viewer
├── (protected)/
│   ├── dashboard/page.tsx
│   └── onboarding/page.tsx         # "Waiting Room" polling UI
├── api/
│   ├── upload/sign/route.ts        # Presigned URL generator
│   ├── resume/
│   │   ├── claim/route.ts          # Claim check handler
│   │   ├── status/route.ts         # Polling endpoint
│   │   └── update/route.ts         # Edit JSON
components/
├── FileDropzone.tsx
├── templates/
│   └── MinimalistCreme.tsx
lib/
├── supabase/
│   ├── client.ts
│   └── server.ts
├── r2.ts                           # S3Client setup
└── replicate.ts                    # Parsing client
```

---

## Environment Variables (Required)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # For server-side operations

# Cloudflare R2
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=webresume-uploads

# AI Parsing
REPLICATE_API_TOKEN=

# Cloudflare Workers (set in dashboard)
NODE_ENV=production
```

---

## Quick Reference Commands

```bash
# Development
bun install
bun run dev

# Deployment
bun run build
npx wrangler deploy

# Database Migrations
# (Run SQL directly in Supabase Dashboard for MVP)

# Testing
bun run test
```

---

## Known Gotchas & Troubleshooting

1. **"Cannot find module 'fs'"**
   - You're on Cloudflare Workers. Use R2 presigned URLs instead.

2. **Next.js Image optimization fails**
   - Use `<img>` tags with CSS. Image optimization requires a server.

3. **Auth redirect loop**
   - Check `NEXT_PUBLIC_SUPABASE_URL` includes protocol (`https://`)
   - Verify redirect URL in Supabase dashboard matches production domain

4. **R2 CORS errors**
   - Add both `localhost:3000` AND production URL to R2 CORS config
   - Allow methods: `GET`, `PUT`, `HEAD`

5. **Replicate parsing timeout**
   - Typical parse time: 20-40s for 2-page resume
   - Implement client-side polling (3s intervals)
   - Add timeout UI after 90s with retry option

---

## Contact & Resources

- **Docs**: See `/docs` directory (prd.md, tech-spec.md, roadmap.md)
- **Architecture Diagrams**: In tech-spec.md
- **Phase Checklists**: In roadmap.md

**Current Phase**: [Update manually as you progress]

---

## Context7 Library IDs (Quick Reference)

When using context7 MCP, these are the library IDs to fetch docs:

- Next.js: `/vercel/next.js`
- Supabase Auth: `/supabase/auth-helpers`
- Cloudflare Workers: `/cloudflare/workers-sdk`
- AWS SDK S3: `/aws/aws-sdk-js-v3`

---

**Last Updated**: 2025-11-18
