# webresume.now MVP — Master Product Requirements Document

## 1. Vision & Goals

- **North Star**: The fastest way to turn a static résumé into a hosted, shareable web portfolio. "Drop a PDF, get a link."
- **Audience**: Job seekers, students, and career switchers who need a clean URL but hate building websites.
- **Core Loop**: Upload (PDF) → Parse (AI) → Polish (Survey) → Publish (Next.js Edge).

### 1.1 Success Metrics (MVP)
- **Conversion**: >60% of users who upload a file complete the Google Auth step.
- **Activation**: >80% of authenticated users publish a live handle.
- **Latency**: "Time to First Interactive Site" (TTFIS) under 60 seconds (including user survey time).

## 2. Guiding Principles & Constraints

1. **Stack**: Next.js 15 (App Router) deployed via OpenNext on Cloudflare Workers.
2. **Database**: Supabase (Postgres + Auth). No Edge Functions; all logic in Next.js Route Handlers.
3. **Storage**: Cloudflare R2. Structure: `{user_id}/{timestamp}/{filename}`.
4. **The "Claim Check" Pattern**: Anonymous uploads generate a local token. Post-auth, the frontend "claims" the upload to attach it to the user.
5. **Privacy First**: Phone numbers and specific street addresses are **hidden by default** on the public site.
6. **Images**: MVP relies on the User's Google Profile Picture by default to ensure every site has a visual element without complex PDF image extraction.
7. **One Template**: "Minimalist Crème." No template switcher logic in the rendering engine yet, just the UI placeholders.

## 3. User Experience Flow

### 3.1 The "No-Friction" Onboarding
1. **Landing**: Hero Text: "Your Résumé is already a Website."
2. **Upload**: Large drop zone. Validates PDF/DOCX (<10MB).
3. **The Handoff (Critical)**:
   - User drops file.
   - Client uploads to R2 presigned URL.
   - Server returns a `temp_upload_id`.
   - Client saves `temp_upload_id` to `localStorage`.
   - **UI**: "Great! To save your site, we need to know it's you." -> Button: "Continue with Google".
4. **Auth & Re-hydration**:
   - User logs in via Supabase Google OAuth.
   - Redirects to `/wizard`.
   - Client reads `temp_upload_id` from storage and calls `POST /api/resume/claim`.
   - Backend moves file from `anon/` to `user/`, triggers Replicate parsing, and deletes the temp key.

### 3.2 Parallel Processing (The "Waiting Room")
*While Replicate is thinking (approx. 20-40s), keep the user busy.*

1. **Status Bar**: Visual stepper: "Uploading ✓" → "Reading File..." → "Generating Site".
2. **The "Polishing" Survey**:
   - **Photo**: Show Google Avatar. Toggle: "Use this photo" vs "Upload new".
   - **Role**: "What is your current target?" (Student, Pro, Founder).
   - **Headline**: Pre-filled if parsing finishes early, otherwise empty.
   - **Privacy**: "Contact Details to Display":
     - [x] Email (uses `mailto`)
     - [ ] Phone Number (Default: OFF)
     - [ ] Home Address (Default: OFF - only City/State shown)
3. **Completion**:
   - Once parsing returns `success` AND survey is done -> "View Site".
   - If parsing fails: Show "Upload Failed" toast, ask to retry (decrement quota).

### 3.3 The Dashboard
- **Header**: `webresume.now/handle` (Clickable).
- **Main Card**: "Current Version". Shows timestamp.
- **Actions**: "Update Résumé" (Re-upload), "Edit Profile" (Re-open survey).
- **Handle Logic**: Users can change handle. Old handles redirect for 30 days (via `handle_redirects` table), then are released.

## 4. Functional Requirements

### 4.1 Parsing Pipeline (Replicate + Datalab Marker)
- **Trigger**: `POST /api/parse` (called automatically after `claim`).
- **Input**: R2 Presigned URL of the PDF.
- **Output**: JSON.
- **Normalization Layer**:
  - The Worker must map the complex Marker JSON into a flat `render_json` structure.
  - **Truncation Rule**: If `experience` array has > 5 items, slice to top 5. If `summary` > 500 chars, truncate. (Prevents layout breaking).

### 4.2 Image Handling
- **Profile Pic**: Stored in `profiles.avatar_url`.
- **Source**: 
  1. Google Auth Metadata (Primary for MVP).
  2. R2 Public Bucket Upload (if user manually replaces it).
- **Optimization**: Use standard HTML `<img src="..." class="rounded-full aspect-square object-cover">`. Cloudflare automatically caches R2 assets, which is sufficient for MVP performance.

### 4.3 Public Page Rendering (`/[handle]`)
- **Edge Rendering**: Page must be Server Component rendered at Edge.
- **Data Fetching**: 
  - `SELECT * FROM profiles JOIN site_render_data ... WHERE handle = slug`.
- **SEO**:
  - `<title>`: `{Name} - {Headline} | WebResume`.
  - `og:image`: The user's avatar URL (simplest dynamic image).
- **Privacy Check**: Before rendering, the code explicitly checks `privacy_settings`. If `show_phone` is false, the phone div is not rendered in the DOM at all.

## 5. Data Model (Supabase)

| Table | Key Columns | Notes |
| :--- | :--- | :--- |
| **profiles** | `id`, `handle`, `email`, `avatar_url`, `privacy_settings (jsonb)` | `privacy_settings` = `{ show_phone: bool, show_address: bool }` |
| **resumes** | `id`, `user_id`, `r2_key`, `status` | `status`: `pending`, `processing`, `completed`, `failed` |
| **site_data** | `user_id`, `resume_id`, `content (jsonb)`, `theme_id` | `content` is the final merged JSON used for rendering. |
| **redirects** | `old_handle`, `new_handle`, `expires_at` | Middleware checks this if handle lookup fails. |

## 6. Technical Stack & Limitations

### 6.1 Cloudflare Worker Constraints
- **No `fs`**: We cannot save files to disk before uploading. All uploads must use `FormData` to R2 presigned URLs.
- **Next.js Image**: We cannot use `<Image />` optimization. We will use CSS `aspect-ratio` and `object-fit` to ensure images look good regardless of source dimensions.

### 6.2 Abuse Protection
- **Rate Limit**: 5 uploads / 24 hours. Tracked in a Redis instance (Upstash) OR simple Postgres count query (cheaper for MVP).
- **File Validation**: Magic number check for PDF/DOCX headers in the API route before passing to R2.

## 7. Release Plan

- **Phase 1: The "Happy Path" (Days 1-7)**
  - Build Landing + R2 Upload + Google Auth.
  - Manually mock the parsed JSON to build the Template UI perfectly first.
- **Phase 2: The "Brain" (Days 8-14)**
  - Integrate Replicate.
  - Build the `claim` logic and `localStorage` handoff.
  - Implement the Survey form.
- **Phase 3: Launch (Day 15)**
  - Deploy to Cloudflare.
  - Post to X/Reddit.
  - Monitor Replicate costs (set a hard limit in Replicate dashboard).
