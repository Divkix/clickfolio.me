# Technical Specification: webresume.now MVP

**Role:** Principal Engineer
**Date:** November 18, 2025
**Status:** Approved for Development
**Target:** Next.js 15 on Cloudflare Workers (via OpenNext)

---

## 1. Architectural Overview

We are building a high-performance, edge-deployed application. To minimize latency and complexity, we lean heavily on **Cloudflare Workers** for compute and **Supabase** for state.

### 1.1 High-Level Architecture

```mermaid
graph TD
    User[User Client]
    CF[Cloudflare Worker (Next.js 15)]
    R2[Cloudflare R2 (Storage)]
    DB[Supabase (Postgres + Auth)]
    AI[Replicate (Datalab Marker)]

    User -- 1. Drop PDF --> CF
    CF -- 2. Presigned URL --> User
    User -- 3. Upload --> R2
    User -- 4. Auth --> DB
    User -- 5. Claim Upload --> CF
    CF -- 6. Trigger Parsing --> AI
    AI -- 7. Webhook/Poll --> CF
    CF -- 8. Save JSON --> DB
    User -- 9. View Site --> CF
```

### 1.2 Infrastructure Decisions

*   **Runtime:** We will use the **Node.js Compatibility Mode** on Cloudflare Workers provided by `@opennextjs/cloudflare`. This avoids the strict limitations of the "Edge" runtime (e.g., `jose` encryption issues for Auth) while still running globally.
*   **Rendering Strategy:**
    *   **Dashboard (`/dashboard`)**: Dynamic, server-rendered (SSR), protected.
    *   **Public Profile (`/[handle]`)**: Dynamic, highly cached (ISR-like behavior via `Cache-Control` headers managed by Next.js).
*   **Parsing Strategy:** We will use **Datalab Marker's "Structured Extraction"** mode via Replicate. Instead of parsing raw markdown, we will inject a JSON Schema into the prompt to force the AI to return structured data (`experience`, `education`, `skills`) immediately.

---

## 2. Data Model (Supabase)

### 2.1 Schema Definitions

```sql
-- 1. PROFILES
-- Extends Supabase Auth. Linked via trigger on auth.users
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  handle text unique not null check (char_length(handle) >= 3),
  email text, -- Copy from auth for easier querying
  avatar_url text,
  headline text,
  privacy_settings jsonb default '{"show_phone": false, "show_address": false}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. RESUMES
-- Tracks the raw file state
create table resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  r2_key text not null, -- path in bucket
  original_filename text,
  status text check (status in ('pending_claim', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz default now()
);

-- 3. SITE_DATA
-- The final "render-ready" JSON for the public site
create table site_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  content jsonb not null, -- structured resume data
  theme_id text default 'minimalist_creme',
  last_published_at timestamptz default now()
);

-- 4. REDIRECTS
-- Handle lifecycle management
create table redirects (
  id uuid default gen_random_uuid() primary key,
  old_handle text not null,
  new_handle text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Indexes
create index idx_profiles_handle on profiles(handle);
create index idx_redirects_old_handle on redirects(old_handle);
```

---

## 3. API & Logic Specifications

### 3.1 Authentication & The "Claim Check"
The critical path is the anonymous-to-authenticated handoff.

1.  **Anonymous Upload**: User calls `POST /api/upload/sign`.
    *   Server returns `{ uploadUrl, key }` (Presigned PUT).
    *   Key format: `temp/{random_uuid}/{filename}`.
    *   Client uploads file to R2.
    *   Client stores `key` in `localStorage.getItem('pending_resume')`.
2.  **Auth**: User signs in with Google. Redirected to `/wizard`.
3.  **Claim**: On mount, `/wizard` checks `localStorage`. If key exists:
    *   Calls `POST /api/resume/claim` with `{ key }`.
    *   **Server Logic**:
        1.  Validate `key` format.
        2.  Create `resumes` row with `status: 'processing'` and `user_id: current_user`.
        3.  Trigger Replicate Job (Async).
        4.  Return `resume_id`.
    *   Client clears `localStorage`.

### 3.2 Resume Parsing (The "Brain")

We use `datalab-to/marker` on Replicate. We utilize the `page_schema` parameter to enforce output structure.

**Input Schema (passed to Replicate):**
```json
{
  "file": "https://r2-bucket.../file.pdf",
  "use_llm": true,
  "page_schema": {
    "type": "object",
    "properties": {
      "full_name": { "type": "string" },
      "headline": { "type": "string", "description": "A 10-word professional summary" },
      "summary": { "type": "string", "maxLength": 500 },
      "contact": {
        "type": "object",
        "properties": {
          "email": { "type": "string" },
          "phone": { "type": "string" },
          "location": { "type": "string" }
        }
      },
      "experience": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "company": { "type": "string" },
            "role": { "type": "string" },
            "dates": { "type": "string" },
            "description": { "type": "string" }
          }
        }
      }
      // ... similar for education/skills
    }
  }
}
```

### 3.3 Public Page Rendering
*   **Path**: `/[handle]/page.tsx`
*   **Logic**:
    1.  `SELECT * FROM profiles WHERE handle = params.handle`.
    2.  If not found, check `redirects` table.
    3.  If found, `SELECT content FROM site_data WHERE user_id = profile.id`.
    4.  **Privacy Filter**:
        ```typescript
        if (!profile.privacy_settings.show_phone) {
          delete content.contact.phone;
        }
        ```
    5.  Render JSX.

---

## 4. Implementation Plan (Vertical Slicing)

We will execute in 5 strict phases. Do not move to the next phase until the current one is deployed to Cloudflare and verified.

### Phase 1: The Skeleton & Plumbing
**Goal**: A deployed Next.js app on Cloudflare with Database connection and Google Auth.
1.  **Setup**: Initialize Next.js 15. Install `@opennextjs/cloudflare`.
2.  **Infra**: Set up Supabase Project & Cloudflare R2 Bucket.
3.  **Auth**: Implement `@supabase/ssr` Google OAuth flow.
4.  **Deploy**: Push to Cloudflare Workers. Verify "Hello World" and Login/Logout work on the live URL.

### Phase 2: The "Drop & Claim" Loop
**Goal**: User can upload a file, log in, and see the file record in the database.
1.  **R2 Integration**: Create `POST /api/upload/sign`. Implement `S3Client` (AWS SDK v3) for presigning.
2.  **Frontend Upload**: Build the Drag-and-Drop zone. Implement `localStorage` logic for the temp key.
3.  **Claim API**: Create `POST /api/resume/claim`.
    *   *Logic*: Insert into `resumes` table.
    *   *Note*: Do NOT implement Replicate yet. Just mock the status as `processing` -> `completed`.
4.  **Validation**: Verify a file dropped by an anon user ends up linked to the authenticated user's ID in Supabase.

### Phase 3: The Viewer (Mocked)
**Goal**: A public profile page that renders data from the DB.
1.  **Seed Data**: Manually insert a JSON blob into `site_data` for your test user.
2.  **Route**: Create `app/[handle]/page.tsx`.
3.  **Fetching**: Implement `getByHandle` query. Handle 404s.
4.  **UI**: Build the "Minimalist Crème" template using Tailwind.
5.  **Validation**: Visit `webresume.now/mytest` and see the manual JSON rendered nicely.

### Phase 4: The Brain (AI Integration)
**Goal**: Replace the mock with actual AI parsing.
1.  **Replicate Client**: Create `lib/replicate.ts`.
2.  **Processing Queue**:
    *   Update `claim` API to trigger Replicate.
    *   Implement a client-side poller in the "Waiting Room" UI (`/waiting`):
        *   Poll `GET /api/resume/status?id=xyz`.
        *   If status `completed`, redirect to Dashboard.
3.  **Webhook/Callback (Optional for MVP, Polling preferred)**:
    *   For MVP, the `status` API can proactively check Replicate API if the DB status is still `processing`. If Replicate is done, update DB and return result.
4.  **Normalization**: Map Replicate's `extraction_schema_json` -> `site_data` table.

### Phase 5: Polish & Launch
**Goal**: The "Edit" loop and Domain handling.
1.  **Survey UI**: Build the form to edit the JSON data (Polishing step).
2.  **Privacy Toggles**: Connect the UI toggles to `profiles.privacy_settings`.
3.  **Rate Limiting**: Add a simple check in `/api/upload/sign`: `SELECT count(*) FROM resumes WHERE user_id = ... AND created_at > now() - interval '1 day'`.
4.  **Launch**: SEO tags, favicon, final distinct clean up.

---

## 5. Engineer's Checklist (Pre-Code)

*   [ ] **Env Vars**: Ensure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `REPLICATE_API_TOKEN` are in Cloudflare Worker secrets (not just `.env.local`).
*   [ ] **Bucket CORS**: Configure R2 CORS to allow PUT from your production domain and localhost.
*   [ ] **Supabase RLS**: Enable RLS.
    *   `profiles`: Public read (handle lookup). User update own.
    *   `resumes`: User read/create own.
    *   `site_data`: Public read. User update own.
*   [ ] **PDF Size Limit**: Enforce 10MB limit in the Presigned URL generation (`content-length-range`).

**Let's build Slice 1.**