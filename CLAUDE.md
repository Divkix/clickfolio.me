# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

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

### 1b. Onboarding Wizard Flow (Post-Auth)

After successful authentication, users are guided through a multi-step wizard to complete their profile:

```typescript
// Middleware checks onboarding_completed flag
if (user && isProtectedRoute && !profile.onboarding_completed) {
  redirect("/wizard");
}
```

**Wizard Steps** (`/wizard` route):

1. **Handle Selection**: User picks a unique username (3+ chars, alphanumeric + hyphens)
2. **Content Review**: Shows parsed resume content (read-only preview)
3. **Privacy Settings**: Toggle phone/address visibility (default: hidden)
4. **Theme Selection**: Choose from available templates (default: MinimalistEditorial)

**Onboarding Completion**:

- Sets `profiles.onboarding_completed = true`
- Creates `site_data` record with chosen theme
- Redirects to `/dashboard`

**Exempt Routes** (skip onboarding check):

- `/wizard`, `/auth/callback`

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

**Retry Mechanism**:

- `resumes.retry_count` tracks parsing attempts (max 2)
- `resumes.replicate_job_id` stores prediction ID for status polling
- If parsing fails, user can retry via `/api/resume/retry` endpoint
- After 2 failed retries, manual intervention required
- Status transitions: `pending_claim` → `processing` → `completed`/`failed`

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
- `handle` (text, unique, min 3 chars, alphanumeric + hyphens)
- `email`, `avatar_url`, `headline`
- `privacy_settings` (jsonb): `{ show_phone: bool, show_address: bool }`
- `onboarding_completed` (bool): Tracks wizard completion
- `created_at`, `updated_at`

**resumes**

- `id`, `user_id` (FK to profiles)
- `r2_key` (path in bucket)
- `status`: `pending_claim`, `processing`, `completed`, `failed`
- `error_message` (text): Stores parsing error details
- `replicate_job_id` (text): Prediction ID for tracking
- `retry_count` (int, default 0): Max 2 retries allowed
- `parsed_at` (timestamp): When AI parsing completed
- `created_at`

**site_data**

- `id`, `user_id` (FK to profiles), `resume_id`
- `content` (jsonb): Render-ready resume JSON
- `theme_id` (text): Template identifier (see Available Templates below)
- `last_published_at`, `created_at`, `updated_at`

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

**File Upload Security**:

```typescript
// ALWAYS validate PDF magic number before R2
const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50; // %PDF

// ALWAYS enforce file size in presigned URL (10MB max)
const presignedUrl = await getSignedUrl(s3Client, putCommand, {
  expiresIn: 3600,
  signableHeaders: new Set(["content-length"]),
  unhoistableHeaders: new Set(["content-length-range"]),
});
```

**XSS Prevention** (Critical):
All user input MUST pass through Zod schemas in `lib/schemas/resume.ts`:

```typescript
import {
  sanitizeText,
  sanitizeUrl,
  sanitizeEmail,
  containsXssPattern,
} from "@/lib/utils/sanitization";

// All text fields use sanitization transforms
const resumeSchema = z.object({
  full_name: z.string().transform(sanitizeText),
  headline: z.string().refine(noXssPattern).transform(sanitizeText),
  summary: z.string().refine(noXssPattern).transform(sanitizeText),
  // ... all fields sanitized
});
```

**Sanitization Functions** (`lib/utils/sanitization.ts`):

- `sanitizeText()`: Strips HTML tags, encodes special chars
- `sanitizeUrl()`: Validates URL format, removes javascript: protocols
- `sanitizeEmail()`: Validates email format, prevents injection
- `containsXssPattern()`: Detects common XSS patterns (script tags, event handlers, data URIs)

**Rate Limiting**:

- Upload: 5 resumes per user per 24 hours (enforced in `/api/resume/claim`)
- Update: 10 content updates per user per hour (enforced in `/api/resume/update`)
- Check via SQL: `SELECT count(*) FROM resumes WHERE user_id = $1 AND created_at > now() - interval '1 day'`

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
temp / { uuid } / { filename }; // Anonymous uploads
users / { user_id } / { timestamp } / { filename }; // Claimed uploads

// NEVER write to filesystem
fs.writeFileSync("..."); // WRONG - not available on Workers
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
├── (auth)/                          # Route group: Authentication
│   ├── auth/callback/route.ts       # OAuth + email confirmation callback handler
│   ├── login/page.tsx               # Login page (email/password, magic link, OAuth)
│   ├── signup/page.tsx              # Signup page with email verification
│   ├── forgot-password/page.tsx     # Request password reset link
│   └── reset-password/page.tsx      # Reset password with token
├── (public)/                        # Route group: Public pages (no auth)
│   ├── [handle]/page.tsx            # Dynamic resume viewer (/username)
│   └── page.tsx                     # Homepage with file upload
├── (protected)/                     # Route group: Auth-required pages
│   ├── dashboard/                   # User dashboard
│   │   ├── page.tsx                 # Main dashboard view
│   │   └── Sidebar.tsx              # Navigation sidebar component
│   ├── edit/page.tsx                # Resume content editor (auto-save)
│   ├── settings/page.tsx            # Privacy & profile settings
│   ├── onboarding/page.tsx          # Legacy waiting room (deprecated)
│   ├── waiting/page.tsx             # AI parsing waiting room with polling
│   └── wizard/                      # Onboarding wizard (4 steps)
│       ├── page.tsx                 # Wizard orchestrator
│       └── [step components...]
├── api/                             # API routes
│   ├── upload/
│   │   └── sign/route.ts            # Generate R2 presigned upload URLs
│   ├── resume/
│   │   ├── claim/route.ts           # Claim anonymous upload, trigger AI parse
│   │   ├── status/route.ts          # Poll parsing status
│   │   ├── retry/route.ts           # Retry failed parsing job
│   │   ├── update/route.ts          # Update site_data content (auto-save)
│   │   └── update-theme/route.ts    # Change template theme
│   ├── profile/
│   │   └── update/route.ts          # Update profile settings
│   ├── wizard/
│   │   └── complete/route.ts        # Mark onboarding complete
│   └── health/route.ts              # Health check endpoint
├── error.tsx                        # Global error boundary
├── not-found.tsx                    # 404 page (matches Soft Depth theme)
├── layout.tsx                       # Root layout with Supabase provider
└── globals.css                      # Global styles + custom animations

components/
├── FileDropzone.tsx                 # Drag-and-drop PDF uploader
├── AttributionWidget.tsx            # Footer attribution link
├── auth/                            # Auth-related components
│   ├── LoginButton.tsx              # Google OAuth button (reusable)
│   ├── EmailInput.tsx               # Email input with validation
│   ├── PasswordInput.tsx            # Password input with show/hide + strength indicator
│   ├── AuthDivider.tsx              # "OR" divider for auth methods
│   ├── MagicLinkButton.tsx          # Passwordless magic link button
│   └── UserMenu.tsx                 # User dropdown menu
├── dashboard/                       # Dashboard-specific components
│   ├── Sidebar.tsx                  # Navigation sidebar
│   ├── ContentPreview.tsx           # Resume content preview
│   └── [other dashboard components...]
├── forms/                           # Form components with react-hook-form
│   ├── EditResumeForm.tsx           # Main edit form with auto-save
│   └── [field components...]
├── settings/                        # Settings page components
│   └── PrivacySettings.tsx          # Phone/address toggle controls
├── templates/                       # Resume templates
│   ├── MinimalistEditorial.tsx      # Default serif template
│   ├── NeoBrutalist.tsx             # Bold brutalist design
│   ├── GlassMorphic.tsx             # Glassmorphism effects
│   └── BentoGrid.tsx                # Mosaic grid layout
├── wizard/                          # Wizard step components
│   ├── HandleStep.tsx               # Step 1: Choose username
│   ├── ReviewStep.tsx               # Step 2: Review parsed content
│   ├── PrivacyStep.tsx              # Step 3: Privacy settings
│   └── ThemeStep.tsx                # Step 4: Template selection
└── ui/                              # Reusable UI components (shadcn/ui)
    ├── button.tsx, input.tsx, etc.

lib/
├── supabase/
│   ├── client.ts                    # Browser client (uses cookies)
│   ├── server.ts                    # Server client (async, for Server Components)
│   ├── middleware.ts                # updateSession() for middleware
│   └── types.ts                     # Generated TypeScript types (from CLI)
├── types/
│   ├── database.ts                  # Manual types (ResumeContent, ProfileData, etc.)
│   └── template.ts                  # Template type definitions
├── schemas/
│   ├── resume.ts                    # Zod schemas for resume validation
│   ├── profile.ts                   # Zod schemas for profile validation
│   └── auth.ts                      # Zod schemas for authentication (login, signup, reset)
├── utils/
│   ├── sanitization.ts              # XSS prevention utilities
│   ├── privacy.ts                   # Privacy filtering (phone/address)
│   └── [other utils...]
├── onboarding/
│   └── wizard-state.ts              # Wizard state management
├── r2.ts                            # AWS S3 client for Cloudflare R2
├── replicate.ts                     # Replicate API client + parsing logic
├── env.ts                           # Environment variable validation (Zod)
└── utils.ts                         # cn() utility (clsx + tailwind-merge)

supabase/
├── migrations/                      # Database migrations (source of truth)
│   ├── 20231118000000_initial_schema.sql
│   ├── 20231119000000_add_retry_count.sql
│   └── [timestamped migrations...]
├── config.toml                      # Supabase local config
└── seed.sql                         # Test data seeding script

middleware.ts                        # Next.js middleware (auth + onboarding check)
wrangler.toml                        # Cloudflare Workers config
open-next.config.ts                  # OpenNext Cloudflare adapter config
```

### Key Routing Patterns

**Route Groups** (folders with parentheses don't affect URL structure):

- `(auth)` → `/auth/callback`
- `(public)` → `/` and `/[handle]`
- `(protected)` → `/dashboard`, `/edit`, `/settings`, `/wizard`

**Dynamic Routes**:

- `/[handle]` → Public resume viewer (e.g., `/johnsmith`)
- Server-side rendered with Supabase data fetch
- Applies privacy filtering before rendering

**API Routes**:

- All in `/api` directory
- Use Next.js Route Handlers (App Router)
- Return JSON responses with proper error handling
- Protected endpoints check authentication via Supabase session

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
bun install                      # Install dependencies
bun run dev                      # Start Next.js dev server (http://localhost:3000)
bun run lint                     # Run ESLint

# Building
bun run build                    # Build Next.js for production
bun run build:worker             # Build and generate Cloudflare Workers bundle
bun run preview                  # Preview Cloudflare build locally (using wrangler)
bun run start                    # Start production server (not for Workers deployment)

# Deployment
bun run deploy                   # Build and deploy to Cloudflare Workers (single command)
bunx wrangler deploy             # Deploy manually with wrangler

# Database (Supabase)
bun run db:start                 # Start local Supabase instance
bun run db:stop                  # Stop local Supabase instance
bun run db:reset                 # Reset local database to initial state
bun run db:migrate               # Run pending migrations
bun run db:migration:new         # Create new migration file (use: bun run db:migration:new <name>)
bun run db:migration:list        # List all migrations (local)
bun run db:push                  # Push local schema changes to remote
bun run db:pull                  # Pull remote schema to local
bun run db:types                 # Generate TypeScript types from linked project
bun run db:types:local           # Generate TypeScript types from local database
bun run db:studio                # Open Supabase Studio (database UI)

# Note: Use supabase CLI commands directly for migrations
# Example: supabase migration new add_column_to_profiles
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

## Available Templates

The application includes multiple professionally designed resume templates, each located in `components/templates/`:

### 1. **MinimalistEditorial** (Default)

- Clean serif typography with editorial magazine aesthetic
- Neutral color palette with subtle accents
- Perfect for traditional industries and professional roles
- File: `components/templates/MinimalistEditorial.tsx`

### 2. **NeoBrutalist**

- Bold, high-contrast design with thick borders
- Black-and-white base with vibrant accent colors
- Heavy sans-serif typography
- Best for creative roles and design portfolios
- File: `components/templates/NeoBrutalist.tsx`

### 3. **GlassMorphic**

- Modern glassmorphism effects with backdrop blur
- Translucent cards with soft shadows
- Dark background with colorful gradients
- Ideal for tech and startup professionals
- File: `components/templates/GlassMorphic.tsx`

### 4. **BentoGrid**

- Mosaic-style layout inspired by Apple's Bento design
- Asymmetric grid with varying card sizes
- Visual hierarchy through layout variation
- Great for showcasing diverse skill sets
- File: `components/templates/BentoGrid.tsx`

### Template Selection

- Users choose their template during the wizard onboarding flow (Step 4)
- Default template is `MinimalistEditorial`
- Theme can be changed later via `/settings` (updates `site_data.theme_id`)
- All templates support the same data structure defined in `lib/types/database.ts`
- Templates are rendered server-side at `/[handle]` route

### Template Development Guidelines

- Each template receives `content` (ResumeContent) and `profile` (ProfileData) props
- Must respect privacy settings (check `profile.privacy_settings`)
- Should handle missing/optional fields gracefully
- Use consistent spacing: Tailwind's spacing scale (p-4, p-6, p-8, etc.)
- Avoid Next.js `<Image />` component (use `<img>` with CSS)
- All templates must be mobile-responsive

---

## Design System: Soft Depth Theme (Landing Page Only)

### Overview

The landing page uses the "Soft Depth" theme—a modern, professional aesthetic inspired by Apple and Stripe's design languages, with enhanced visual richness through layered shadows and gradient accents.

### Core Principles

1. **Calm Professionalism**: Light, airy backgrounds (slate-50) create a calming workspace
2. **Layered Depth**: Multi-layer shadows create visual hierarchy without heavy borders
3. **Gradient Accents**: Indigo→Blue gradients add sophistication without overwhelming
4. **Smooth Interactions**: 300ms transitions for all hover states and animations

### Color Palette

**Primary Colors:**

- Background: `slate-50` (#F8FAFC)
- Text Primary: `slate-900` (#0F172A)
- Text Secondary: `slate-600` (#475569)
- Border: `slate-200/60` (with 60% opacity)

**Gradient Accents:**

- Primary Gradient: `indigo-600` (#4F46E5) → `blue-600` (#3B82F6) → `cyan-500` (#06B6D4)
- Button Gradient: `indigo-600` → `blue-600`
- Logo Gradient: `indigo-600` → `blue-600`

**Feature Card Gradients:**

- Speed: `orange-500` (#F97316) → `amber-600` (#D97706)
- AI: `indigo-600` → `purple-600` (#9333EA)
- Free: `emerald-500` (#10B981) → `teal-600` (#0D9488)

### Shadow System

Custom layered shadows for depth perception:

```css
--shadow-depth-sm: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-depth-md:
  0 2px 8px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.08);
--shadow-depth-lg:
  0 4px 16px rgba(0, 0, 0, 0.06), 0 16px 64px rgba(0, 0, 0, 0.12);
--shadow-depth-xl:
  0 8px 24px rgba(0, 0, 0, 0.08), 0 24px 96px rgba(0, 0, 0, 0.16);
```

**Usage:**

- Header/Footer: `shadow-depth-sm`
- Upload zone (default): `shadow-depth-md`
- Upload zone (hover): `shadow-depth-lg`
- Modal dropzone: `shadow-depth-sm` → `shadow-depth-md` on hover

### Animation System

All animations defined in `app/globals.css`:

**1. Fade In Up** (`animate-fade-in-up`)

- Duration: 0.6s ease-out
- Used on: Hero section
- Transform: translateY(20px) → translateY(0)
- Opacity: 0 → 1

**2. Float** (`animate-float`)

- Duration: 6s ease-in-out infinite
- Used on: (reserved for future use)
- Transform: translateY(0) → translateY(-10px) → translateY(0)

**3. Gradient Shift** (`animate-gradient-shift`)

- Duration: 8s ease infinite
- Used on: Gradient backgrounds
- Background position: 0% → 100% → 0%

**4. Shimmer** (`animate-shimmer`)

- Duration: 2s linear infinite
- Used on: LoginButton hover overlay
- Background position: -200% → 200%

**Accessibility:**

- All animations respect `prefers-reduced-motion: reduce`
- Animations are disabled for users who request reduced motion

### Component Patterns

**1. Elevated Cards**

- White background (`bg-white`)
- Border: `border border-slate-200/60`
- Shadow: `shadow-depth-sm` (default), `shadow-depth-md` (hover)
- Border radius: `rounded-2xl` (16px)
- Padding: `p-8` (32px)

**2. Gradient Buttons**

- Background: `bg-linear-to-r from-indigo-600 to-blue-600`
- Text: `text-white font-semibold`
- Hover: Darker gradient (`from-indigo-700 to-blue-700`)
- Shadow: `shadow-depth-sm` → `shadow-depth-md` on hover
- Transition: `transition-all duration-300`

**3. Icon Containers**

- Background: Gradient (e.g., `from-indigo-100 to-blue-100`)
- Glow effect: Blurred gradient overlay (`blur-xl opacity-20`)
- Border radius: `rounded-xl` (12px)
- Padding: `p-3` or `p-4`

**4. SVG Gradients**
All icons use gradient strokes/fills defined inline:

```tsx
<defs>
  <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stopColor="#4F46E5" />
    <stop offset="100%" stopColor="#3B82F6" />
  </linearGradient>
</defs>
```

### Typography

**Headings:**

- Hero H1: `text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight`
- Card Headlines: `text-2xl font-bold` or `text-3xl font-bold`
- Subheadings: `text-lg font-semibold`

**Body Text:**

- Hero subtitle: `text-xl sm:text-2xl font-light leading-relaxed`
- Card descriptions: `text-sm font-medium`
- Helper text: `text-xs font-medium`

**Font Weights:**

- Light: 300 (hero subtitle)
- Medium: 500 (body text, labels)
- Semibold: 600 (buttons, card titles)
- Bold: 700 (numbers, emphasis)
- Extrabold: 800 (hero headline)

### Hover Effects

**Standard Lift Pattern:**

```tsx
hover:-translate-y-0.5 hover:shadow-depth-md transition-all duration-300
```

**Upload Zone Special:**

- Default: `shadow-depth-md`
- Hover: `shadow-depth-lg` + `-translate-y-1`
- Gradient overlay fades in: `opacity-0` → `opacity-100`
- Icon scales: `scale-100` → `scale-110`

### Responsive Breakpoints

Follow Tailwind defaults:

- `sm:` 640px (tablets)
- `md:` 768px (small laptops)
- `lg:` 1024px (desktops)

**Mobile-First Approach:**

- Base styles for mobile
- Add `sm:`, `lg:` modifiers for larger screens
- Grid: `grid-cols-1 sm:grid-cols-3` for feature cards

### Performance Considerations

1. **CSS-Only Animations**: All animations use CSS keyframes, no JavaScript
2. **GPU Acceleration**: Transforms use `will-change` hints where needed
3. **Reduced Motion**: All animations disabled via `prefers-reduced-motion`
4. **Shadow Optimization**: Shadows use RGBA for better performance than hex
5. **Gradient Performance**: `background-size: 200%` for smooth gradient shifts

### Design Conflicts to Avoid

**DO NOT** make landing page look like existing templates:

- ❌ Editorial serif typography (MinimalistEditorial)
- ❌ Dark backgrounds with noise overlays (GlassMorphic)
- ❌ Thick black borders with hard shadows (NeoBrutalist)
- ❌ Bento grid mosaic layouts (BentoGrid)

**Landing page should:**

- ✅ Use light backgrounds (slate-50, not dark)
- ✅ Use soft shadows (not hard drops or glassmorphism)
- ✅ Use indigo/blue gradients (not template-specific colors)
- ✅ Use standard layouts (not editorial or mosaic grids)

---

## Contact & Resources

- **Docs**: See `/docs` directory (prd.md, tech-spec.md, roadmap.md)
- **Architecture Diagrams**: In tech-spec.md
- **Phase Checklists**: In roadmap.md

**Current Phase**: Phase 5 Complete (Production Ready)

---

## Complete User Journey (E2E Flow)

Understanding the full user experience is critical for debugging and feature development:

### 1. Anonymous Upload (Homepage)

- User visits `/` (homepage)
- Drags PDF onto `FileDropzone` component OR clicks to browse
- Client requests presigned URL: `POST /api/upload/sign`
- File uploaded directly to R2 with temp key: `temp/{uuid}/{filename}`
- Temp upload key stored in `localStorage` as `temp_upload_id`
- `LoginButton` appears prompting Google OAuth

### 2. Authentication

Users have multiple authentication options:

**Option A: Email/Password**

- User clicks "Create Account" → redirected to `/login` → clicks "Sign up" → `/signup`
- User enters email, password (8+ chars, uppercase, lowercase, digit, special)
- System sends confirmation email via Supabase
- User clicks confirmation link → redirected to `/auth/callback` → `/wizard`
- Profile created via database trigger during signup

**Option B: Magic Link (Passwordless)**

- User enters email on `/login` page
- Clicks "Send Magic Link" button
- User clicks link in email → redirected to `/auth/callback` → `/wizard` or `/dashboard`
- No password required

**Option C: Google OAuth**

- User clicks "Continue with Google" on `/login` page
- Redirects to Google OAuth consent screen
- On success, callback to `/auth/callback`
- Supabase creates `auth.users` row and `profiles` row (via database trigger)
- Avatar updated from Google metadata
- User redirected to `/wizard` or `/dashboard` based on onboarding status

**Callback Handler** (`/auth/callback`):

- Handles OAuth code, email confirmation tokens, and magic link tokens
- Detects auth type via `user.app_metadata.provider` (google/email)
- Updates avatar only for OAuth providers
- Checks `onboarding_completed` flag
- Redirects to `/wizard` if incomplete, `/dashboard` if complete

**Password Reset Flow**:

- User goes to `/forgot-password` → enters email → receives reset link
- User clicks link → redirected to `/reset-password` with token
- User enters new password → updates via Supabase → redirected to `/login`

### 3. Wizard Onboarding (4 Steps)

Located at `/wizard`, managed by `components/wizard/*`:

**Step 1: Handle** (`HandleStep.tsx`)

- User enters desired username (3+ chars, alphanumeric + hyphens)
- Real-time availability check against `profiles.handle`
- Validation: Must be unique, no special chars

**Step 2: Review** (`ReviewStep.tsx`)

- Shows AI-parsed resume content (read-only)
- User can see what will be published
- Background: Claim API already triggered parsing

**Step 3: Privacy** (`PrivacyStep.tsx`)

- Toggle: "Show phone number" (default OFF)
- Toggle: "Show full address" (default OFF)
- Updates `profiles.privacy_settings` jsonb

**Step 4: Theme** (`ThemeStep.tsx`)

- User selects from 4 templates (MinimalistEditorial default)
- Live preview of each template
- Sets `site_data.theme_id`

On completion:

- `POST /api/wizard/complete` sets `onboarding_completed = true`
- User redirected to `/dashboard`

### 4. AI Parsing (Background)

Triggered by claim API, tracked in `/waiting`:

- Status: `pending_claim` → `processing`
- Replicate job created with `datalab-to/marker` model
- Client polls `/api/resume/status` every 3 seconds
- Parsing takes 30-40 seconds typically
- On success: `status = completed`, data saved to `site_data.content`
- On failure: `status = failed`, user can retry (max 2 attempts)

### 5. Dashboard (`/dashboard`)

Post-onboarding landing page:

- Shows current handle: `webresume.now/{handle}`
- Preview of public site (iframe or link)
- Quick actions: Edit content, Change theme, View analytics
- `Sidebar` component for navigation

### 6. Editing (`/edit`)

Content editor with auto-save:

- `EditResumeForm` component with react-hook-form
- 3-second debounce on all fields
- Auto-saves to `/api/resume/update`
- Updates `site_data.content` and `updated_at`
- Success toast notification on save

### 7. Settings (`/settings`)

Privacy and profile management:

- Update privacy toggles (phone/address visibility)
- Change theme via `/api/resume/update-theme`
- Update profile info (avatar, headline)
- Delete account option (future)

### 8. Public Profile (`/[handle]`)

The actual published resume:

- Server-side rendered (SSR)
- Fetches `profiles` + `site_data` by handle
- Applies privacy filtering before render
- Renders chosen template with user content
- SEO metadata: title, description, OG tags
- Cache-Control headers for edge caching

### Error States

- **Upload fails**: Show error message, allow retry
- **Parsing fails**: Redirect to `/waiting` with retry button
- **Handle taken**: Inline validation error in wizard
- **Not authenticated**: Middleware redirects to `/`
- **Onboarding incomplete**: Middleware redirects to `/wizard`
- **404 handle**: Custom 404 page matching Soft Depth theme

---

## Context7 Library IDs (Quick Reference)

When using context7 MCP, these are the library IDs to fetch docs:

- Next.js: `/vercel/next.js`
- Supabase Auth: `/supabase/auth-helpers`
- Cloudflare Workers: `/cloudflare/workers-sdk`
- AWS SDK S3: `/aws/aws-sdk-js-v3`

---

**Last Updated**: 2025-11-20 (via /init command)
