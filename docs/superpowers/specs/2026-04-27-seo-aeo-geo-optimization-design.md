# clickfolio.me SEO / AEO / GEO Optimization Spec

**Date:** 2026-04-27
**Status:** Approved (pending review)

## Background

clickfolio.me turns PDF resumes into hosted web portfolios. The product is superior to
competitors (10 templates, privacy controls, `/@handle` URLs, Cloudflare CDN, GPT-4 class
AI parsing), but discoverability is the bottleneck. The competitive landscape analysis shows
no dominant player owns the "pdf resume to website" category — this is the window to capture it.

The strategy covers three engine types: **SEO** (traditional search — Google, Bing),
**AEO** (Answer Engine Optimization — featured snippets, People Also Ask), and **GEO**
(Generative Engine Optimization — ChatGPT, Perplexity, Claude, Google AI Overviews).

---

## Layer 1: Technical Foundation (Immediate)

### 1.1 Root Layout Metadata

**File:** `app/layout.tsx`

- Replace flat `title` string with `title.template`:
  ```ts
  title: {
    template: "%s | clickfolio.me",
    default: "clickfolio.me — Turn your resume into a website",
  }
  ```
  This ensures all descendant pages get branded titles automatically.

- Add default `robots: { index: true, follow: true }` so pages without explicit robots
  metadata don't accidentally get no-indexed.

- Add default `openGraph.images` fallback (homepage OG image URL) so pages without their
  own OG image (privacy, terms, explore, verify-email) get social previews.

### 1.2 Admin Layout Noindex

**File:** `app/(admin)/admin/layout.tsx`
**New file:** `app/(public)/layout.tsx` (or use `layout.tsx` in the public route group)

- Export `metadata: { robots: { index: false, follow: false } }` from admin layout.
  Currently admin pages have NO robots directive and could be indexed.

### 1.3 Preview Page Blocking

**File:** `app/robots.ts`

- Add `Disallow: /preview/` to robots.txt.
- Add metadata `robots: { index: false }` to `app/preview/[id]/page.tsx`.

### 1.4 Sitemap Fixes

**File:** `lib/sitemap.ts`

- Update `lastModified` for `/privacy` from hardcoded `2025-01-01` to actual date (Feb 2026).
- Update `lastModified` for `/terms` from hardcoded `2025-12-01` to actual date.
- Add `<image:image>` extensions to user profile sitemap entries using avatar URLs for
  Google Image Search indexing.

### 1.5 Homepage Description Expansion

**File:** `app/page.tsx`

- Expand metadata description from 87 chars to 150-160 chars:
  "Turn your PDF resume into a beautiful hosted portfolio website in seconds. Free resume
  website builder with 10 templates, AI-powered parsing, custom URL, and privacy controls.
  No sign-up required to upload."

### 1.6 Template Alt Text Fix

**Files:** `components/templates/neo-brutalist.tsx`, `components/templates/glass-morphic.tsx`

- Change generic `alt="Avatar"` / `alt="Profile"` to use the person's full name
  (e.g., `alt={content.full_name}`), matching other templates.

### 1.7 OG Images for Missing Pages

- Add `openGraph.images` metadata to `/explore`, `/privacy`, `/terms`.
  All three can reuse the homepage OG image (`/api/og/home`) as a fallback.

---

## Layer 2: Structured Data & Schema Enhancement

### 2.1 Profile Page Date Signals

**File:** `app/[handle]/page.tsx`, `lib/utils/json-ld.ts`

- Pass `siteData.createdAt` and `siteData.updatedAt` from the DB query to
  `generateResumeJsonLd()` so the `ProfilePage` schema receives `dateCreated` and
  `dateModified`. The generator already supports these fields — just not wired.

### 2.2 Sitelinks Searchbox

**File:** `app/page.tsx`

- Add `potentialAction: SearchAction` to the `WebSite` schema:
  ```json
  {
    "@type": "WebSite",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://clickfolio.me/explore?search={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }
  ```

### 2.3 Homepage FAQPage Schema

**File:** `app/page.tsx`

- Add an FAQ section to the homepage (below features / above bottom CTA).
- Include `FAQPage` JSON-LD with these questions:
  1. "What is clickfolio.me?" — "clickfolio.me is a free tool that turns your PDF resume
     into a professionally hosted portfolio website in seconds using AI."
  2. "How does AI resume parsing work?" — Explanation of the process.
  3. "Is clickfolio.me really free?" — "Yes, forever. Six templates are free, four premium
     templates are unlocked by referring friends."
  4. "Can I use a custom URL?" — "Every portfolio gets a short clickfolio.me/@yourname URL
     that's easy to share."
  5. "How accurate is the AI parsing?" — Description of accuracy and editing capabilities.

### 2.4 Explore Page Schema Enhancement

**File:** `app/explore/page.tsx`

- Add `mainEntity.itemListElement` with proper `@id` references to the `ItemList` schema
  for stronger AI engine understanding of the directory structure.

### 2.5 Entity Consistency

**Files:** `app/page.tsx`, `app/[handle]/page.tsx`

- Ensure `Organization` schema (used as `worksFor` in Person schemas and as publisher)
  uses identical `name`, `url`, and `logo` values across all pages.
- Ensure `WebSite` schema on homepage is referenced with `@id` from all `WebPage` schemas.

---

## Layer 3: AEO / GEO Strategy (AI Engine Optimization)

### 3.1 llms.txt Creation

**New file:** `public/llms.txt`

Standard for AI crawlers (ChatGPT, Perplexity, Claude, Bing Copilot). Format:

```
# clickfolio.me
> Turn your PDF resume into a hosted web portfolio. Upload → AI Parse → Publish.
> Free, fast, AI-powered. 10 templates, privacy controls, custom /@handle URL.

## How it works
- Upload your PDF resume (no signup required)
- AI parses your content: skills, experience, education, contact info
- Get a live portfolio at clickfolio.me/@yourname
- 10 templates (6 free, 4 referral-gated premium)
- Privacy toggles for phone, address visibility
- Full editing suite with auto-save

## Key pages
- Home: https://clickfolio.me
- Browse portfolios: https://clickfolio.me/explore
- Open source: https://github.com/clickfolio/clickfolio.me

## Templates
- MinimalistEditorial: Clean magazine-style, serif (Free)
- NeoBrutalist: Bold borders, high contrast (Free)
- GlassMorphic: Dark theme with frosted glass (Free)
- BentoGrid: Modern mosaic layout (Free)
- ClassicATS: ATS-optimized single-column (Free)
- DevTerminal: GitHub-inspired dark terminal (Free)
- DesignFolio: Digital brutalism meets Swiss typography (3 referrals)
- Spotlight: Warm creative portfolio with animations (3 referrals)
- Midnight: Dark minimal, serif headings, gold accents (5 referrals)
- BoldCorporate: Executive typography, bold numbered sections (10 referrals)
```

**New file:** `public/llms-full.txt`

Extended version with detailed markup structure, JSON-LD examples, and API information
for AI context training.

**Route access:** Both files placed in `public/` so they're served as static assets
by Cloudflare Workers.

### 3.2 Profession-Specific Landing Pages

Create route group `app/(public)/for/` with these pages:

| Route | Target Query | Title |
|-------|-------------|-------|
| `/for/software-engineers` | "resume website for software engineers" | Portfolio Website for Software Engineers |
| `/for/designers` | "portfolio website for designers" | Portfolio Website for Designers |
| `/for/students` | "free portfolio website for students" | Free Portfolio Website for Students |
| `/for/product-managers` | "resume portfolio for product managers" | Portfolio Website for Product Managers |
| `/for/consultants` | "professional portfolio for consultants" | Portfolio Website for Consultants |
| `/for/developers` | "developer resume website" | Portfolio Website for Developers |

Each page gets:
- Unique metadata (title, description, OG image)
- Profession-specific copy explaining why a portfolio site matters for that role
- Template recommendations (which templates suit that profession)
- Example profile links from `/explore` filtered by role (if available)
- JSON-LD: `WebPage`, `BreadcrumbList`, and `SoftwareApplication` (with profession context)
- CTA to create portfolio
- Internal links to blog, explore, and homepage
- Canonical URL
- Sitemap inclusion (high priority, weekly)

**Implementation approach:** A single dynamic page component at `app/(public)/for/[profession]/page.tsx`
using `generateStaticParams` with all profession slugs, and a profession-specific content map.

### 3.3 Citation-Worthy Data

**File:** `app/page.tsx`

- Add a stats bar section with factual claims AI can cite:
  - Number of templates available
  - "Free forever" commitment
  - Description of the AI parsing quality
- These should be rendered as visible HTML text (not images) so AI crawlers read them.

### 3.4 JSON-LD on All Pages

Ensure every public page has at minimum:
- `WebPage` with `isPartOf` referencing the `WebSite` entity
- `BreadcrumbList` with at minimum `Home > CurrentPage`

---

## Layer 4: On-Site Content Strategy (Blog)

### 4.1 Blog Infrastructure

**New files:**
- `app/(public)/blog/layout.tsx` — Blog layout with sidebar (TOC + CTA + related links)
- `app/(public)/blog/page.tsx` — Blog index with article cards, pagination

**Blog metadata:**
- Title: "Blog | clickfolio.me"
- Description: "Guides and tips for resume writing, portfolio websites, and career growth."
- OG image (share the homepage OG or a dedicated blog OG)

### 4.2 Blog Posts (Priority Order)

Each post lives at `app/(public)/blog/[slug]/page.tsx` with content in MDX or server-rendered content.

#### Post 1: Complete Guide (P0)
**Slug:** `pdf-resume-to-website`
**Title:** "PDF Resume to Website Converter: The Complete Guide (2026)"
**Target keywords:** "pdf resume to website", "convert resume to portfolio", "turn resume into website"
**Est. traffic:** 2,400/mo
**Outline:**
1. Why host your resume as a website
2. How AI resume parsing works
3. Step-by-step: PDF → Portfolio in 60 seconds
4. Templates and customization
5. Privacy controls and sharing
6. Comparison with alternatives (LinkedIn, PDF resumes, other tools)
7. FAQ section
**Schema:** `Article` + `FAQPage` JSON-LD

#### Post 2: Tool Comparison (P0)
**Slug:** `best-resume-website-builders`
**Title:** "Best Free Resume Website Builders in 2026: Compared & Ranked"
**Target keywords:** "best free resume website builder", "resume website tools compared"
**Est. traffic:** 3,400/mo
**Outline:**
1. Why use a resume website builder
2. Comparison table (clickfolio.me, Magic Self, DockPage, SpaceLoom, EZfolio CV, etc.)
3. Detailed review of each tool
4. Our recommendation
**Schema:** `Article` JSON-LD, comparison table marked up with definition lists

#### Post 3: Template Showcase (P0)
**Slug:** `resume-website-templates`
**Title:** "10 Free Resume Website Templates: Find Your Perfect Fit"
**Target keywords:** "resume website templates", "free portfolio templates", "resume design templates"
**Est. traffic:** 500/mo
**Outline:**
1. Why templates matter
2. Showcase each of the 10 templates with real examples
3. Which template for which profession
4. How to switch templates
**Schema:** `Article` + `ItemList` JSON-LD

#### Post 4: AI Parsing Deep Dive (P1)
**Slug:** `how-ai-resume-parsing-works`
**Title:** "How AI Resume Parsing Works: Accuracy, Privacy & What to Expect"
**Target keywords:** "AI resume parser", "how does AI parse resumes", "AI resume accuracy"
**Est. traffic:** 1,200/mo
**Outline:**
1. What is AI resume parsing
2. How clickfolio.me's parser works (extract → analyze → structure)
3. Accuracy benchmarks
4. Privacy: your data is yours
5. Manual editing after parsing
**Schema:** `Article` + `HowTo` JSON-LD

#### Post 5: LinkedIn → Website (P1)
**Slug:** `linkedin-to-portfolio-website`
**Title:** "From LinkedIn Profile to Professional Portfolio Website"
**Target keywords:** "linkedin to portfolio website", "linkedin resume to website"
**Est. traffic:** 540/mo
**Outline:**
1. LinkedIn vs personal portfolio: pros and cons
2. How to export your LinkedIn data
3. Converting LinkedIn PDF to a portfolio with clickfolio.me
4. What to add beyond LinkedIn
**Schema:** `Article` JSON-LD

#### Post 6: ATS vs Portfolio (P2)
**Slug:** `ats-vs-portfolio-website`
**Title:** "ATS-Friendly Resume vs Portfolio Website: Why You Need Both in 2026"
**Target keywords:** "ATS resume vs portfolio", "why have a resume website"
**Est. traffic:** 400/mo
**Outline:**
1. What ATS does and doesn't do
2. What a portfolio website adds
3. How clickfolio.me bridges both (ClassicATS template)
4. Strategy: PDF for ATS, website for humans
**Schema:** `Article` JSON-LD

#### Post 7: Resume Writing Guide (P2)
**Slug:** `how-to-write-resume-2026`
**Title:** "How to Write a Resume That Gets Noticed (2026 Edition)"
**Target keywords:** "how to write a resume", "resume writing tips 2026"
**Est. traffic:** High-volume but competitive
**Schema:** `Article` + `FAQPage` JSON-LD

#### Post 8: Resume Privacy Guide (P2)
**Slug:** `resume-privacy-guide`
**Title:** "Resume Privacy: What Information to Share Online (and What to Hide)"
**Target keywords:** "resume privacy settings", "what to put on online resume"
**Schema:** `Article` JSON-LD

### 4.3 Blog Post Implementation

Each post is an MDX file in a `content/blog/` directory, rendered by a single dynamic route.
This avoids creating individual page.tsx files for each post.

**MdxContent component** renders the MDX with appropriate styling (Tailwind prose).
**Table of Contents** is extracted from H2/H3 headings and rendered as a sidebar.
**Social share buttons** (Twitter/X, LinkedIn, copy link).
**CTA banner** at bottom: "Create your own portfolio — free, no signup required."

---

## Layer 5: Growth Mechanisms & Internal Linking

### 5.1 Internal Linking Architecture

```
Homepage ──────┬──→ Explore (/explore)
               ├──→ Templates Showcase Blog Post
               ├──→ Blog Index (/blog)
               ├──→ Profession Pages (/for/*)
               └──→ FAQ Section (anchor on homepage)

Blog Posts ────┬──→ Other blog posts (related posts)
               ├──→ Profession pages (contextual)
               ├──→ Explore
               └──→ Homepage

Explore ───────┬──→ Individual Portfolios (@handle)
               └──→ Homepage

Profession ────┬──→ Explore (filtered by role)
Pages          ├──→ Blog posts (related)
               └──→ Homepage

Portfolio ─────┬──→ Explore
(@handle)      ├──→ Homepage (via attribution widget)
               └──→ CreateYoursCTA
```

### 5.2 Visible Breadcrumb Navigation

Add a `Breadcrumb` UI component with `BreadcrumbList` JSON-LD to all public pages:

| Page | Breadcrumb |
|------|-----------|
| Home | Home |
| Explore | Home > Explore Professionals |
| Blog | Home > Blog |
| Blog Post | Home > Blog > Post Title |
| Profession | Home > Profession Name Portfolios |
| Portfolio | Home > Explore > Person Name |
| Privacy | Home > Privacy Policy |
| Terms | Home > Terms of Service |

### 5.3 Template Semantic Enhancements

- Add `<address>` element wrapping contact information on all templates (sends location/contact signals to search engines).
- Revisit `@id` references in JSON-LD for organizations, schools, and other entities that repeat across profiles.

### 5.4 Homepage Social Proof
- Replace generic browser mockup images with real profile screenshots from published portfolios.
- Use real names/handles in testimonial-style presentations.

---

## Layer 6: Monitoring & Verification

### 6.1 Post-Implementation Verification
- Verify sitemap XML renders correctly at `/sitemap.xml`
- Verify robots.txt at `/robots.txt`
- Submit updated sitemap to GSC
- Submit updated sitemap to Bing Webmaster Tools
- Verify `llms.txt` at `/llms.txt`
- Verify `llms-full.txt` at `/llms-full.txt`
- Validate JSON-LD on homepage using Google Rich Results Test
- Validate JSON-LD on a sample `@handle` page
- Validate JSON-LD on blog posts
- Verify all pages have canonical URLs
- Verify admin pages (`/admin`, `/admin/*`) return `noindex` in meta/headers

### 6.2 Ongoing Monitoring
- GSC: Index coverage report (watch for excluded pages, crawl errors)
- GSC: Performance report (impressions, clicks, position by query)
- GSC: Core Web Vitals for profile pages
- Weekly: Check for new GSC issues
- Monthly: Review keyword positions, identify new content opportunities

---

## Out of Scope
- Multilingual support / hreflang tags (English-only for now)
- Paid search / PPC campaigns
- Email marketing automation
- Social media marketing strategy
- Link building / backlink outreach (organic through GitHub and product quality)

---

## Implementation Order

1. **Technical Foundation** (metadata, noindex, robots.txt, sitemap fixes, OG images, alt text)
2. **Structured Data** (FAQPage, date signals, sitelinks searchbox, entity consistency)
3. **AEO/GEO** (llms.txt, llms-full.txt, profession pages)
4. **Blog Infrastructure** (layout, index page, MDX pipeline)
5. **Blog Posts** (priority order as listed)
6. **Growth Mechanisms** (breadcrumb UI, internal linking, social proof)
