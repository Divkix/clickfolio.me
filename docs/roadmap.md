# 🛠️ webresume.now MVP — Implementation Roadmap

## 🟢 Phase 1: The "Walking Skeleton" (Infra & Auth)

**Goal**: A deployed Next.js 15 app on Cloudflare Workers that connects to Supabase and allows Google Login.

- [ ] **1.1. Project Initialization**
  - [ ] Initialize Next.js 15 App Router project (`npx create-next-app@latest`).
  - [ ] Install Cloudflare adapter: `npm install @opennextjs/cloudflare`.
  - [ ] Configure `wrangler.toml` with `compatibility_flags = ["nodejs_compat"]`.
  - [ ] Clean up boilerplate code; create a simple `app/page.tsx` with "Hello World".

- [ ] **1.2. Supabase Setup**
  - [ ] Create new Supabase Project.
  - [ ] SQL: Run the **Profiles** table migration (from Tech Spec section 2.1).
  - [ ] SQL: Enable Row Level Security (RLS) on `profiles`.
  - [ ] Auth: Enable Google OAuth Provider in Supabase Dashboard.
  - [ ] Env: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.

- [ ] **1.3. Authentication Implementation**
  - [ ] Install `@supabase/ssr`.
  - [ ] Create `utils/supabase/server.ts` (Cookie handling) and `client.ts`.
  - [ ] Create `app/auth/callback/route.ts` to handle the OAuth code exchange.
  - [ ] Create a Login Button component calling `signInWithOAuth`.
  - [ ] Create a Logout Button component.
  - [ ] Create a protected route `app/dashboard/page.tsx` that redirects to `/` if not logged in.

- [ ] **1.4. Deployment & Verification**
  - [ ] Push code to GitHub.
  - [ ] Connect Cloudflare Pages/Workers to repo.
  - [ ] Add Supabase Env vars to Cloudflare Dashboard.
  - [ ] **Manual Test**: Deploy. Visit live URL. Log in with Google. Verify you are redirected to dashboard and a user row is created in Supabase `auth.users`.

---

## 🔵 Phase 2: The "Drop & Claim" Loop (Input Handling)

**Goal**: An anonymous user can upload a PDF, log in, and the system "claims" that PDF for their account.

- [ ] **2.1. Storage Infrastructure (R2)**
  - [ ] Create Cloudflare R2 Bucket named `webresume-uploads`.
  - [ ] Configure R2 CORS (Allow `PUT` from localhost and production URL).
  - [ ] Generate R2 Access Keys (Key ID & Secret). Add to Cloudflare Worker Secrets.
  - [ ] SQL: Run **Resumes** table migration.

- [ ] **2.2. Presigned Upload API**
  - [ ] Install AWS SDK S3 Client: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
  - [ ] Create API Route: `POST /api/upload/sign`.
  - [ ] Logic: Generate a randomized key `temp/{uuid}/{filename}`. Return the Presigned PUT URL.
  - [ ] Security: Enforce `content-length-range` (max 10MB) and `content-type` (application/pdf).

- [ ] **2.3. Frontend Upload UX**
  - [ ] Create `components/FileDropzone.tsx`.
  - [ ] Logic: On file drop, call signing API, then `PUT` file to R2.
  - [ ] **Critical Logic**: On success, save `{ temp_key: "..." }` to `localStorage`.
  - [ ] UI: Show "Upload Complete. Log in to save." button.

- [ ] **2.4. The Claim API**
  - [ ] Create API Route: `POST /api/resume/claim`.
  - [ ] Logic:
    1. Authenticate user (Reject if anon).
    2. Read `key` from body.
    3. Move object in R2 from `temp/` to `users/{user_id}/` (Optional for MVP, or just track path).
    4. Insert row into `resumes` table with `status: 'pending_claim'`.
  - [ ] **Manual Test**: Drop file (Incognito). Log in. Check Supabase `resumes` table for new row linked to your User ID.

---

## 🟣 Phase 3: The "Viewer" (Output Rendering)

**Goal**: A high-performance public page that renders resume data (mocked for now).

- [ ] **3.1. Mock Data Setup**
  - [ ] SQL: Run **Site_Data** table migration.
  - [ ] SQL: Manually insert a dummy JSON record into `site_data` for your test user ID.
    ```json
    { "name": "Test User", "headline": "Engineer", "summary": "Hello world" }
    ```

- [ ] **3.2. The Public Route (`/[handle]`)**
  - [ ] Create `app/[handle]/page.tsx`.
  - [ ] Logic: `await supabase.from('profiles').select(...).eq('handle', params.handle)`.
  - [ ] Join: Fetch related `site_data`.
  - [ ] 404 Handling: Render a clean "Resume not found" page if invalid handle.

- [ ] **3.3. The "Minimalist Crème" Template**
  - [ ] Create `components/templates/MinimalistCreme.tsx`.
  - [ ] Style: Use Tailwind typography plugin.
  - [ ] Sections: Header (Avatar/Name), Summary, Experience, Education, Skills.
  - [ ] **Manual Test**: Visit `localhost:3000/my-handle`. Verify it loads the SQL mock data.

---

## 🟠 Phase 4: The "Brain" (AI Integration)

**Goal**: Replace the mock data with real data extracted from the PDF via Replicate.

- [ ] **4.1. Replicate Integration**
  - [ ] Get Replicate API Token. Add to Env.
  - [ ] Create `lib/replicate.ts`.
  - [ ] Update `POST /api/resume/claim`:
    - [ ] After inserting DB row, call Replicate `datalab-to/marker`.
    - [ ] Pass the `page_schema` defined in Tech Spec.
    - [ ] Update DB status to `processing`.

- [ ] **4.2. Polling & Status Check**
  - [ ] Create API Route: `GET /api/resume/status`.
  - [ ] Logic:
    - [ ] Check DB status.
    - [ ] If `processing`, call Replicate API to check job status.
    - [ ] If Replicate says `succeeded`:
      - [ ] Fetch JSON output.
      - [ ] **Normalize**: Map `extraction_json` to our `site_data` schema.
      - [ ] Insert into `site_data`.
      - [ ] Update `resumes` status to `completed`.
      - [ ] Return `completed` to client.

- [ ] **4.3. The "Waiting Room" UX**
  - [ ] Build `/waiting` page.
  - [ ] Logic: `useInterval` to poll status API every 3 seconds.
  - [ ] UI: Simple stepper or loading bar.
  - [ ] Success: When status is `completed`, redirect to `/dashboard`.
  - [ ] **Manual Test**: Upload a real PDF. Watch the loading screen. Verify the final JSON appears in the database.

---

## 🔴 Phase 5: Polish & Dashboard (The User Loop)

**Goal**: Allow users to edit their data, set handles, and control privacy.

- [ ] **5.1. Dashboard UI**
  - [ ] Fetch current user's `site_data`.
  - [ ] Show "View Live Site" button.
  - [ ] Show "Update Resume" (re-upload) button.

- [ ] **5.2. The "Polishing" Survey (Edit Form)**
  - [ ] Create a form to edit the JSON content (Name, Headline, Summary).
  - [ ] Create API Route: `PUT /api/resume/update`.
  - [ ] Logic: Update `site_data` column.
  - [ ] Add "Regenerate" option (optional, low priority).

- [ ] **5.3. Privacy & Settings**
  - [ ] Add Toggles: "Show Phone", "Show Address".
  - [ ] Update `profiles` table `privacy_settings` column.
  - [ ] **Critical**: Update `[handle]/page.tsx` to respect these flags before rendering.

- [ ] **5.4. SEO & Metadata**
  - [ ] Add `generateMetadata` in `[handle]/page.tsx`.
  - [ ] Set dynamic `<title>` and OpenGraph images (use Avatar).

- [ ] **5.5. Final Launch Sweep**
  - [ ] Rate Limiting: Add basic IP/User check in Upload API.
  - [ ] Error Boundaries: Graceful failure if Replicate errors out.
  - [ ] Final Deploy to Cloudflare.
  - [ ] **Manual Test**: Full E2E run. Upload -> Auth -> Parse -> Edit -> Share Link.
