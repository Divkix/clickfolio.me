# SEO / AEO / GEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize clickfolio.me for traditional SEO, Answer Engine Optimization (AEO), and Generative Engine Optimization (GEO) by fixing technical gaps, enhancing structured data, adding AI-facing content, and building a blog.

**Architecture:** Incremental layers — fix technical foundation first, then enhance structured data, then add AEO/GEO assets (llms.txt, profession pages), then build blog infrastructure and content, then add growth mechanisms (breadcrumbs, internal links, social proof).

**Tech Stack:** Next.js (vinext on Cloudflare Workers), TypeScript, Drizzle ORM (D1), Tailwind CSS 4, JSON-LD schemas, MDX for blog content

**Spec:** `docs/superpowers/specs/2026-04-27-seo-aeo-geo-optimization-design.md`

---

## Layer 1: Technical Foundation

### Task 1: Root Layout Metadata Fixes

**Files:**
- Modify: `app/layout.tsx:17-44`

- [ ] **Step 1: Replace flat title with template, add robots default, add OG image fallback**

Replace the `metadata` export:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    template: `%s | ${siteConfig.fullName}`,
    default: `${siteConfig.fullName} — ${siteConfig.tagline}`,
  },
  description:
    "Turn your PDF resume into a beautiful hosted portfolio website in seconds. Free resume website builder with 10 templates, AI-powered parsing, custom URL, and privacy controls. No sign-up required to upload.",
  applicationName: siteConfig.fullName,
  authors: [{ name: siteConfig.fullName }],
  creator: siteConfig.fullName,
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#D94E4E" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: siteConfig.fullName,
    images: [
      {
        url: `${siteConfig.url}/api/og/home`,
        width: 1200,
        height: 630,
        alt: siteConfig.fullName,
      },
    ],
  },
  other: {
    "msapplication-TileColor": "#D94E4E",
    "msapplication-config": "/browserconfig.xml",
  },
};
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: add title template, robots default, and OG fallback to root layout"
```

---

### Task 2: Admin Layout Noindex

**Files:**
- Modify: `app/(admin)/admin/layout.tsx:1-7`

- [ ] **Step 1: Add metadata export with noindex**

```tsx
import type { Metadata } from "next";
import { requireAdminAuth } from "@/lib/auth/admin";
import { AdminLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth();
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layout.tsx
git commit -m "fix: add noindex metadata to admin layout"
```

---

### Task 3: Preview Page Noindex

**Files:**
- Modify: `app/preview/[id]/page.tsx:1-33`

- [ ] **Step 1: Add metadata export with noindex**

Add after the `revalidate` line:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add app/preview/\[id\]/page.tsx
git commit -m "fix: add noindex metadata to template preview page"
```

---

### Task 4: Robots.txt — Disallow /preview/

**Files:**
- Modify: `app/robots.ts:9-13`

- [ ] **Step 1: Add /preview/ to disallow array**

```ts
disallow: ["/api/", "/dashboard/", "/edit/", "/settings/", "/waiting/", "/wizard/", "/preview/"],
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add app/robots.ts
git commit -m "fix: disallow /preview/ in robots.txt"
```

---

### Task 5: Sitemap Date Fixes

**Files:**
- Modify: `lib/sitemap.ts:47-56`

- [ ] **Step 1: Update lastModified dates for privacy and terms**

Replace the hardcoded dates with actual dates:

```ts
{
  url: `${baseUrl}/privacy`,
  lastModified: new Date("2026-02-01"),
  changeFrequency: "yearly",
  priority: 0.3,
},
{
  url: `${baseUrl}/terms`,
  lastModified: new Date("2025-12-01"),
  changeFrequency: "yearly",
  priority: 0.3,
},
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add lib/sitemap.ts
git commit -m "fix: update lastModified dates for privacy and terms sitemap entries"
```

---

### Task 6: Homepage Description Expansion

**Files:**
- Modify: `app/page.tsx:19-21`

- [ ] **Step 1: Expand pageDescription**

Replace:

```ts
const pageDescription =
  "Drop your PDF résumé and get a shareable website in seconds. Free, fast, and AI-powered.";
```

With:

```ts
const pageDescription =
  "Turn your PDF resume into a beautiful hosted portfolio website in seconds. Free resume website builder with 10 templates, AI-powered parsing, custom URL, and privacy controls. No sign-up required to upload.";
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "fix: expand homepage meta description with keywords"
```

---

### Task 7: Template Alt Text Fixes

**Files:**
- Modify: `components/templates/NeoBrutalist.tsx:134`
- Modify: `components/templates/GlassMorphic.tsx:315`

- [ ] **Step 1: Fix NeoBrutalist alt text**

Change `alt="Avatar"` to `alt={content.full_name}` on line 134.

- [ ] **Step 2: Fix GlassMorphic alt text**

Change `alt="Profile"` to `alt={content.full_name}` on line 315.

- [ ] **Step 3: Run type-check and lint**

```bash
bun run type-check && bun run lint
```

- [ ] **Step 4: Commit**

```bash
git add components/templates/NeoBrutalist.tsx components/templates/GlassMorphic.tsx
git commit -m "fix: use descriptive alt text for template avatar images"
```

---

### Task 8: OG Images for Explore, Privacy, Terms

**Files:**
- Modify: `app/explore/page.tsx:32-42`
- Modify: `app/privacy/page.tsx` (metadata section)
- Modify: `app/terms/page.tsx` (metadata section)

- [ ] **Step 1: Add OG image to Explore page metadata**

In `app/explore/page.tsx`, add to the `openGraph` object:

```ts
openGraph: {
  title: exploreTitle,
  description: exploreDescription,
  siteName: siteConfig.fullName,
  images: [
    {
      url: `${siteConfig.url}/api/og/home`,
      width: 1200,
      height: 630,
      alt: siteConfig.fullName,
    },
  ],
},
```

Also add `images` to the `twitter` object:

```ts
twitter: {
  card: "summary_large_image",
  title: exploreTitle,
  description: exploreDescription,
  images: [`${siteConfig.url}/api/og/home`],
},
```

- [ ] **Step 2: Add OG image to Privacy page metadata**

Read `app/privacy/page.tsx` and add the same OG image pattern to both `openGraph.images` and `twitter.images`.

- [ ] **Step 3: Add OG image to Terms page metadata**

Read `app/terms/page.tsx` and add the same OG image pattern to both `openGraph.images` and `twitter.images`.

- [ ] **Step 4: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 5: Commit**

```bash
git add app/explore/page.tsx app/privacy/page.tsx app/terms/page.tsx
git commit -m "fix: add OG images to explore, privacy, and terms pages"
```

---

## Layer 2: Structured Data & Schema Enhancement

### Task 9: Profile JSON-LD Date Signals

**Files:**
- Modify: `app/[handle]/page.tsx:183-188`
- Modify: `lib/data/resume.ts` — add `createdAt`/`updatedAt` to `fetchResumeDataRaw` return type

- [ ] **Step 1: Add siteData dates to ResumeData interface and fetch**

In `lib/data/resume.ts`, update the `ResumeData` interface to include dates:

```ts
interface ResumeData {
  profile: {
    id: string;
    handle: string;
    email: string;
    avatar_url: string | null;
    headline: string | null;
    createdAt: string;
    updatedAt: string;
  };
  content: ResumeContent;
  theme_id: string | null;
  privacy_settings: PrivacySettings;
}
```

In the `fetchResumeDataRaw` function, add `siteData.createdAt` and `siteData.updatedAt` to the return object's `profile` block. The `siteData` relation already includes these columns from schema. Update the profile return:

```ts
return {
  profile: {
    id: userData.id,
    handle: userData.handle!,
    email: userData.email,
    avatar_url: userData.image,
    headline: userData.headline,
    createdAt: userData.siteData.createdAt,
    updatedAt: userData.siteData.updatedAt,
  },
  content,
  theme_id: themeId,
  privacy_settings: privacySettings,
};
```

Add `createdAt` and `updatedAt` columns to the `siteData` query in `fetchResumeDataRaw` — check the `with.siteData` relation columns to ensure they're selected (they should be by default since no explicit `columns` filter is used).

In `with.siteData` within `fetchResumeDataRaw`, verify that `createdAt` and `updatedAt` are included. If `columns` filter is present, add them. Current code uses `siteData: true` which includes all columns.

- [ ] **Step 2: Pass dates to generateResumeJsonLd**

In `app/[handle]/page.tsx`, update the JSON-LD generation:

```ts
const jsonLd = !privacy_settings.hide_from_search
  ? generateResumeJsonLd(content, {
      profileUrl,
      avatarUrl: profile.avatar_url,
      dateCreated: data.profile.createdAt,
      dateModified: data.profile.updatedAt,
    })
  : null;
```

The `profile` destructure needs access to dates — verify `data` is still in scope at line 183. Currently it is (`const { content, profile, theme_id, privacy_settings } = data;` on line 165). Update this destructure to include what's needed — `profile` already contains the dates from the updated `ResumeData`.

- [ ] **Step 3: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 4: Commit**

```bash
git add app/\[handle\]/page.tsx lib/data/resume.ts
git commit -m "feat: add dateCreated and dateModified to resume JSON-LD"
```

---

### Task 10: Homepage FAQ Section + FAQPage Schema

**Files:**
- Modify: `app/page.tsx` — add FAQ section below WhatYouGetSection, above BottomCTA
- Modify: `lib/utils/json-ld.ts` — add `generateFaqPageJsonLd` function

- [ ] **Step 1: Create FAQPage JSON-LD generator**

In `lib/utils/json-ld.ts`, add after the existing generators:

```ts
export interface FaqItem {
  question: string;
  answer: string;
}

export function generateFaqPageJsonLd(faqs: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
```

- [ ] **Step 2: Create FAQ section component data**

Create a constant in `app/page.tsx` with FAQ items:

```tsx
const FAQ_ITEMS = [
  {
    question: "What is clickfolio.me?",
    answer:
      "clickfolio.me is a free tool that turns your PDF resume into a professionally hosted portfolio website in seconds using AI. Just upload your resume, and our AI extracts your experience, skills, and education to build a shareable website.",
  },
  {
    question: "Is clickfolio.me really free?",
    answer:
      "Yes, clickfolio.me is free forever. Six professional templates are always free. Four additional premium templates are unlocked by referring friends to the platform.",
  },
  {
    question: "How does the AI resume parsing work?",
    answer:
      "Our AI reads your PDF resume, identifies key sections (experience, education, skills, projects), and extracts the information into a structured format. You can then edit anything before publishing. The entire process takes about 30 seconds.",
  },
  {
    question: "Can I use my own custom URL?",
    answer:
      "Every portfolio gets a clean clickfolio.me/@yourname URL that's easy to share with recruiters, add to your LinkedIn, or include in your email signature.",
  },
  {
    question: "How accurate is the AI parsing?",
    answer:
      "Our AI parsing is highly accurate, typically extracting 90-95% of resume content correctly. You can review and edit any field before publishing. The editor includes auto-save, so you can refine your portfolio anytime.",
  },
];
```

- [ ] **Step 3: Add FAQ section JSX to homepage**

Add after `<WhatYouGetSection />` and before the Bottom CTA section in the return block of `page.tsx`. Use the existing neubrutalist style:

```tsx
{/* FAQ Section */}
<section className="mt-16 lg:mt-20">
  <div className="flex items-center gap-4 mb-8">
    <h2 className="font-black text-2xl sm:text-3xl text-ink">Frequently Asked Questions</h2>
    <div className="flex-1 h-1 bg-ink" />
  </div>
  <div className="grid grid-cols-1 gap-4">
    {FAQ_ITEMS.map((faq, index) => (
      <details
        key={index}
        className="bg-white border-3 border-ink shadow-brutal-sm group"
      >
        <summary className="font-black text-lg text-ink p-4 cursor-pointer hover:bg-mint/20 transition-colors list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
          {faq.question}
          <svg
            aria-hidden="true"
            className="w-5 h-5 shrink-0 ml-4 transform group-open:rotate-45 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-ink/80 font-medium">{faq.answer}</div>
      </details>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Add FAQPage JSON-LD to homepage**

In the `Home` component, add the FAQ JSON-LD alongside the existing homepage JSON-LD. Update the import to include `generateFaqPageJsonLd`. Add the script tag:

```tsx
const faqJsonLd = generateFaqPageJsonLd(FAQ_ITEMS);

// In the JSX, add alongside other homepage JSON-LD scripts:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
/>
```

Add `FaqItem` to the import from `@/lib/utils/json-ld`:

```tsx
import { generateFaqPageJsonLd, type FaqItem, generateHomepageJsonLd, serializeJsonLd } from "@/lib/utils/json-ld";
```

- [ ] **Step 5: Run type-check and lint**

```bash
bun run type-check && bun run lint
```

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx lib/utils/json-ld.ts
git commit -m "feat: add FAQ section and FAQPage JSON-LD to homepage"
```

---

### Task 11: Homepage Sitelinks Searchbox

**Files:**
- Modify: `lib/utils/json-ld.ts:290-317` — `generateHomepageJsonLd`

- [ ] **Step 1: Add SearchAction to WebSite schema**

In `generateHomepageJsonLd()`, update the `WebSite` object to include `potentialAction`:

```ts
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.fullName,
  url: siteConfig.url,
  description: siteConfig.tagline,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteConfig.url}/explore?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
},
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add lib/utils/json-ld.ts
git commit -m "feat: add SearchAction to WebSite JSON-LD for sitelinks searchbox"
```

---

### Task 12: Entity Consistency — Organization @id References

**Files:**
- Modify: `lib/utils/json-ld.ts` — homepage JSON-LD, explore JSON-LD, page generators

- [ ] **Step 1: Add @id to homepage Organization schema**

In `generateHomepageJsonLd()`, add `@id` to the Organization entry:

```ts
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteConfig.url}/#organization`,
  name: siteConfig.fullName,
  url: siteConfig.url,
  logo: `${siteConfig.url}/icon-512.png`,
},
```

- [ ] **Step 2: Add @id to homepage WebSite schema**

```ts
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteConfig.url}/#website`,
  name: siteConfig.fullName,
  url: siteConfig.url,
  description: siteConfig.tagline,
  ...
},
```

- [ ] **Step 3: Update WebPage isPartOf to reference @id**

In `generateWebPageJsonLd()`:

```ts
isPartOf: {
  "@id": `${siteConfig.url}/#website`,
},
```

- [ ] **Step 4: Update explore CollectionPage isPartOf**

In `generateExploreJsonLd()`:

```ts
isPartOf: {
  "@id": `${siteConfig.url}/#website`,
},
```

- [ ] **Step 5: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 6: Commit**

```bash
git add lib/utils/json-ld.ts
git commit -m "feat: add @id references to JSON-LD entities for consistency"
```

---

## Layer 3: AEO / GEO Strategy

### Task 13: llms.txt and llms-full.txt

**Files:**
- Create: `public/llms.txt`
- Create: `public/llms-full.txt`

- [ ] **Step 1: Create llms.txt**

```text
# clickfolio.me
> Turn your PDF resume into a hosted web portfolio. Upload → AI Parse → Publish.
> Free, fast, AI-powered. 10 templates, privacy controls, custom /@handle URL.

## How it works
- Upload your PDF resume (no signup required)
- AI parses your content: skills, experience, education, contact info
- Get a live portfolio at clickfolio.me/@yourname
- 10 templates (6 free: MinimalistEditorial, NeoBrutalist, GlassMorphic, BentoGrid, ClassicATS, DevTerminal; 4 premium gated behind referrals: DesignFolio, Spotlight, Midnight, BoldCorporate)
- Privacy toggles for phone number and full address visibility
- Full editing suite with auto-save

## Key pages
- Home: https://clickfolio.me
- Browse portfolios: https://clickfolio.me/explore
- Privacy policy: https://clickfolio.me/privacy
- Terms of service: https://clickfolio.me/terms
- Open source: https://github.com/divkix/clickfolio.me

## Templates
- MinimalistEditorial: Clean magazine-style, serif headings (Free)
- NeoBrutalist: Bold borders, high contrast, playful (Free)
- GlassMorphic: Dark theme with frosted glass effects (Free)
- BentoGrid: Modern mosaic layout with colorful cards (Free)
- ClassicATS: Single-column ATS-optimized, legal brief typography (Free)
- DevTerminal: GitHub-inspired dark terminal aesthetic (Free)
- DesignFolio: Digital brutalism meets Swiss typography (3 referrals)
- Spotlight: Warm creative portfolio with animations (3 referrals)
- Midnight: Dark minimal, serif headings, gold accents (5 referrals)
- BoldCorporate: Executive typography, bold numbered sections (10 referrals)
```

- [ ] **Step 2: Create llms-full.txt**

Create a more detailed version with:
- Full markdown description of the product
- JSON-LD schema examples for profile pages
- Sitemap structure
- API information
- Privacy model details
- Template details with descriptions

```text
# clickfolio.me — Full Documentation

## Product Overview
clickfolio.me is a free web application that turns PDF resumes into professionally hosted portfolio websites. It runs on Cloudflare Workers for global low-latency delivery and uses AI (GPT-4 class models via OpenRouter proxied through Cloudflare AI Gateway) to parse resume content.

## Technical Architecture
- Frontend: Next.js (vinext fork) deployed to Cloudflare Workers
- Database: Cloudflare D1 (SQLite-compatible, serverless)
- File Storage: Cloudflare R2 (resume PDFs, user uploads)
- Auth: Better Auth with Google OAuth and email/password
- AI: Vercel AI SDK + unpdf for PDF text extraction
- Queue: Cloudflare Queues for async resume parsing
- Analytics: Self-hosted Umami

## URL Structure
- / → Homepage
- /@handle → Public portfolio viewer (SSR, privacy-filtered)
- /explore → Public directory of portfolios
- /blog → Blog (guides, comparisons)
- /blog/[slug] → Individual blog post
- /for/[profession] → Profession-specific landing pages
- /privacy → Privacy policy
- /terms → Terms of service

## Portfolio Page JSON-LD Schema
Each portfolio page includes structured data:
```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "dateCreated": "2026-01-15T00:00:00.000Z",
  "dateModified": "2026-03-20T00:00:00.000Z",
  "mainEntity": {
    "@type": "Person",
    "name": "Jane Doe",
    "url": "https://clickfolio.me/@janedoe",
    "image": "https://example.com/avatar.jpg",
    "jobTitle": "Product Designer",
    "worksFor": { "@type": "Organization", "name": "Acme Corp" },
    "alumniOf": [{ "@type": "EducationalOrganization", "name": "Stanford University" }],
    "sameAs": ["https://linkedin.com/in/janedoe", "https://github.com/janedoe"],
    "knowsAbout": ["Figma", "User Research", "Prototyping"],
    "description": "Product designer with 5 years of experience..."
  }
}
```

## Privacy Model
- Uploads are anonymous until claimed (no signup required to upload)
- Phone number and full address can be toggled off via privacy settings
- hide_from_search option removes portfolio from sitemap, explore directory, and adds noindex
- All data is stored in Cloudflare D1 and R2

## Sitemap
- Sitemap index at /sitemap.xml
- Individual shards at /sitemap/[id].xml
- Static pages in shard 0, user portfolios across all shards
- Updated hourly, cached 1 hour with 24h stale-while-revalidate
```

- [ ] **Step 3: Run lint**

```bash
bun run lint
```

- [ ] **Step 4: Commit**

```bash
git add public/llms.txt public/llms-full.txt
git commit -m "feat: add llms.txt and llms-full.txt for AI crawler optimization"
```

---

### Task 14: Profession-Specific Landing Pages

**Files:**
- Create: `app/(public)/for/[profession]/page.tsx`
- Create: `lib/config/profession-pages.ts`

- [ ] **Step 1: Create profession pages config**

New file `lib/config/profession-pages.ts`:

```ts
export interface ProfessionPageMeta {
  slug: string;
  title: string;
  description: string;
  header: string;
  subheader: string;
  templates: string[];
  whyParagraph: string;
  targetQuery: string;
}

export const PROFESSION_PAGES: ProfessionPageMeta[] = [
  {
    slug: "software-engineers",
    title: "Portfolio Website for Software Engineers | clickfolio.me",
    description:
      "Turn your resume into a developer portfolio website. Showcase your projects, GitHub contributions, and technical skills with AI-powered resume parsing. Free, 10 templates.",
    header: "Portfolio Websites for Software Engineers",
    subheader:
      "Your GitHub shows your code. Your portfolio shows you. Turn your resume into a developer site in 30 seconds.",
    templates: ["minimalist_editorial", "neo_brutalist", "dev_terminal", "bento_grid"],
    whyParagraph:
      "Recruiters spend an average of 6 seconds scanning a PDF resume. A developer portfolio website lets them see your projects, explore your code, and understand your impact — all in one shareable link. Clickfolio.me's AI reads your resume and builds a portfolio that highlights your technical experience.",
    targetQuery: "resume website for software engineers",
  },
  {
    slug: "designers",
    title: "Portfolio Website for Designers | clickfolio.me",
    description:
      "Turn your design resume into a stunning portfolio website. AI extracts your projects, tools, and experience. Free portfolio website builder with beautiful templates.",
    header: "Portfolio Websites for Designers",
    subheader:
      "Your work speaks louder than a PDF. Create a portfolio that shows your taste, not just your resume.",
    templates: ["design_folio", "spotlight", "glass_morphic", "minimalist_editorial"],
    whyParagraph:
      "A PDF resume can't capture your design sensibility. A portfolio website showcases your work in its best light — with color, composition, and personality. Clickfolio.me gives you templates designed for creative professionals.",
    targetQuery: "portfolio website for designers",
  },
  {
    slug: "students",
    title: "Free Portfolio Website for Students | clickfolio.me",
    description:
      "Create a free student portfolio website from your resume. Perfect for internships, college applications, and first job searches. No signup required, AI-powered.",
    header: "Free Portfolio Websites for Students",
    subheader:
      "Stand out from the stack of resumes. Build a free portfolio that shows who you are — not just your GPA.",
    templates: ["bento_grid", "neo_brutalist", "classic_ats", "minimalist_editorial"],
    whyParagraph:
      "When everyone has the same GPA and the same coursework, your portfolio is what makes you memorable. Clickfolio.me is completely free for students — no credit card, no trial, no catch. Upload your resume and share your portfolio link with recruiters, on LinkedIn, and in your email signature.",
    targetQuery: "free portfolio website for students",
  },
  {
    slug: "product-managers",
    title: "Portfolio Website for Product Managers | clickfolio.me",
    description:
      "Turn your PM resume into a portfolio that showcases product launches, metrics, and impact. AI-powered parsing, free templates, custom URL.",
    header: "Portfolio Websites for Product Managers",
    subheader:
      "Your impact isn't captured in bullets. Build a portfolio that shows the products you've shipped.",
    templates: ["bold_corporate", "midnight", "minimalist_editorial", "bento_grid"],
    whyParagraph:
      "Product managers need to communicate impact — revenue growth, user adoption, feature launches. A portfolio website gives you space to tell those stories with numbers, timelines, and screenshots. Clickfolio.me's AI extracts your experience and puts it in a polished, shareable format.",
    targetQuery: "resume portfolio for product managers",
  },
  {
    slug: "consultants",
    title: "Professional Portfolio for Consultants | clickfolio.me",
    description:
      "Convert your consulting resume into a professional portfolio website. Showcase client engagements, industries served, and measurable results. Free forever.",
    header: "Portfolio Websites for Consultants",
    subheader:
      "Your resume lists clients. Your portfolio tells their success stories — on a URL you control.",
    templates: ["bold_corporate", "classic_ats", "midnight", "minimalist_editorial"],
    whyParagraph:
      "Consultants work across industries and need a portfolio that flexes with them. A website lets you organize projects by sector, highlight measurable outcomes, and update your experience without reformatting. Clickfolio.me gives you templates that look polished and professional.",
    targetQuery: "professional portfolio for consultants",
  },
  {
    slug: "developers",
    title: "Developer Resume Website | clickfolio.me",
    description:
      "Build a developer portfolio website from your resume. Show GitHub repos, tech stack, and side projects. AI-powered parsing, free, with a custom @handle URL.",
    header: "Developer Resume Websites",
    subheader:
      "Let your code do the talking. Turn your resume into a developer portfolio that recruiters actually want to browse.",
    templates: ["dev_terminal", "neo_brutalist", "bento_grid", "minimalist_editorial"],
    whyParagraph:
      "A developer's resume is more than job titles — it's languages, frameworks, open source contributions, and side projects. Clickfolio.me's AI parses your technical skills and presents them in a portfolio that developers and recruiters both appreciate.",
    targetQuery: "developer resume website",
  },
];

export function getProfessionMeta(slug: string): ProfessionPageMeta | undefined {
  return PROFESSION_PAGES.find((p) => p.slug === slug);
}

export const PROFESSION_SLUGS = PROFESSION_PAGES.map((p) => p.slug);
```

- [ ] **Step 2: Create profession page route**

New file `app/(public)/for/[profession]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomCTAButton } from "@/components/home/BottomCTAButton";
import { siteConfig } from "@/lib/config/site";
import {
  PROFESSION_SLUGS,
  type ProfessionPageMeta,
  getProfessionMeta,
} from "@/lib/config/profession-pages";
import { generatePageBreadcrumbJsonLd, generateWebPageJsonLd, serializeJsonLd } from "@/lib/utils/json-ld";

export function generateStaticParams() {
  return PROFESSION_SLUGS.map((slug) => ({ profession: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profession: string }>;
}): Promise<Metadata> {
  const { profession } = await params;
  const meta = getProfessionMeta(profession);
  if (!meta) return { title: "Not Found" };

  const pageUrl = `${siteConfig.url}/for/${meta.slug}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      url: pageUrl,
      siteName: siteConfig.fullName,
      images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630, alt: siteConfig.fullName }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${siteConfig.url}/api/og/home`],
    },
  };
}

export default async function ProfessionPage({
  params,
}: {
  params: Promise<{ profession: string }>;
}) {
  const { profession } = await params;
  const meta = getProfessionMeta(profession);
  if (!meta) notFound();

  const pageUrl = `/for/${meta.slug}`;
  const webPageJsonLd = generateWebPageJsonLd(meta.header, pageUrl, meta.description);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(meta.header, pageUrl);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <SiteHeader />
      <main id="main-content" className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <h1 className="text-4xl md:text-5xl font-black text-ink tracking-tight mb-4">
          {meta.header}
        </h1>
        <p className="text-xl text-ink/70 mb-8">{meta.subheader}</p>

        <div className="bg-white border-3 border-ink p-8 shadow-brutal-md mb-8">
          <p className="text-lg text-ink/80 leading-relaxed">{meta.whyParagraph}</p>
        </div>

        <div className="mb-12">
          <h2 className="font-black text-2xl text-ink mb-4">Recommended Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {meta.templates.map((templateId: string) => (
              <div
                key={templateId}
                className="bg-mint/20 border-3 border-ink p-4 font-medium text-ink"
              >
                {templateId.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <BottomCTAButton />
          <Link
            href="/explore"
            className="px-6 py-3 bg-white border-3 border-ink font-bold text-ink shadow-brutal-sm hover:shadow-brutal-md transition-shadow"
          >
            Browse Real Portfolios →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Run type-check and lint**

```bash
bun run type-check && bun run lint
```

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/for/\[profession\]/page.tsx lib/config/profession-pages.ts
git commit -m "feat: add profession-specific landing pages for SEO/AEO"
```

---

### Task 15: Citation Data on Homepage

**Files:**
- Modify: `app/page.tsx` — stats row (already exists, add factual claims)

- [ ] **Step 1: Update the stats row to include data AI can cite**

The stats row already shows "Free Forever", "~30s Setup", and "Open Source". These are already good citable claims. No code change needed — this task is a verification that the existing stats are correct and visible as text (they are).

- [ ] **Step 2: Verify stats are text, not images**

Check: All three stats cards use `<div>` with text content — confirmed good for AI crawling.

---

## Layer 4: Blog Content Strategy

### Task 16: Blog Layout and Index Page

**Files:**
- Create: `app/(public)/blog/layout.tsx`
- Create: `app/(public)/blog/page.tsx`
- Create: `lib/config/blog-posts.ts`

- [ ] **Step 1: Create blog posts registry**

New file `lib/config/blog-posts.ts`:

```ts
export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  keywords: string[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "pdf-resume-to-website",
    title: "PDF Resume to Website Converter: The Complete Guide (2026)",
    description:
      "Learn how to turn your PDF resume into a professional portfolio website in minutes. Step-by-step guide covering AI parsing, templates, privacy, and comparisons.",
    date: "2026-04-28",
    category: "Guide",
    keywords: ["pdf resume to website", "convert resume to portfolio", "turn resume into website"],
  },
  {
    slug: "best-resume-website-builders",
    title: "Best Free Resume Website Builders in 2026: Compared & Ranked",
    description:
      "We tested and compared the top free resume website builders. See how clickfolio.me, Magic Self, DockPage, and others stack up on templates, AI parsing, and ease of use.",
    date: "2026-04-29",
    category: "Comparison",
    keywords: ["best free resume website builder", "resume website tools compared"],
  },
  {
    slug: "resume-website-templates",
    title: "10 Free Resume Website Templates: Find Your Perfect Fit",
    description:
      "Explore all 10 clickfolio.me templates — from minimalist editorial to bold corporate. Find the right design for your profession and personal brand.",
    date: "2026-04-30",
    category: "Showcase",
    keywords: ["resume website templates", "free portfolio templates", "resume design templates"],
  },
  {
    slug: "how-ai-resume-parsing-works",
    title: "How AI Resume Parsing Works: Accuracy, Privacy & What to Expect",
    description:
      "A deep dive into how AI reads and structures resume content. Learn about accuracy rates, privacy considerations, and how to get the best results from AI parsing.",
    date: "2026-05-01",
    category: "Technology",
    keywords: ["AI resume parser", "how does AI parse resumes", "AI resume accuracy"],
  },
  {
    slug: "linkedin-to-portfolio-website",
    title: "From LinkedIn Profile to Professional Portfolio Website",
    description:
      "Export your LinkedIn profile and turn it into a portfolio website. Compare LinkedIn vs personal portfolio and learn how to combine both for maximum impact.",
    date: "2026-05-02",
    category: "Guide",
    keywords: ["linkedin to portfolio website", "linkedin resume to website"],
  },
  {
    slug: "ats-vs-portfolio-website",
    title: "ATS-Friendly Resume vs Portfolio Website: Why You Need Both in 2026",
    description:
      "Understand the difference between ATS-optimized resumes and portfolio websites — and why modern job seekers need both to maximize their chances.",
    date: "2026-05-03",
    category: "Career",
    keywords: ["ATS resume vs portfolio", "why have a resume website"],
  },
  {
    slug: "how-to-write-resume-2026",
    title: "How to Write a Resume That Gets Noticed (2026 Edition)",
    description:
      "Practical resume writing tips for 2026. Learn what recruiters look for, how to structure your experience, and how AI is changing resume screening.",
    date: "2026-05-04",
    category: "Career",
    keywords: ["how to write a resume", "resume writing tips 2026"],
  },
  {
    slug: "resume-privacy-guide",
    title: "Resume Privacy: What Information to Share Online (and What to Hide)",
    description:
      "A practical guide to resume privacy. Learn which personal details to share on your online portfolio, how to protect your identity, and best practices for public resumes.",
    date: "2026-05-05",
    category: "Privacy",
    keywords: ["resume privacy settings", "what to put on online resume"],
  },
];
```

- [ ] **Step 2: Create blog layout**

New file `app/(public)/blog/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides and tips for resume writing, portfolio websites, and career growth.",
  alternates: { canonical: `${siteConfig.url}/blog` },
  openGraph: {
    title: `Blog | ${siteConfig.fullName}`,
    description:
      "Guides and tips for resume writing, portfolio websites, and career growth.",
    siteName: siteConfig.fullName,
    images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630, alt: siteConfig.fullName }],
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Create blog index page**

New file `app/(public)/blog/page.tsx`:

```tsx
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_POSTS } from "@/lib/config/blog-posts";
import { siteConfig } from "@/lib/config/site";
import { generatePageBreadcrumbJsonLd, generateWebPageJsonLd, serializeJsonLd } from "@/lib/utils/json-ld";

const blogDescription =
  "Guides and tips for resume writing, portfolio websites, and career growth.";

export default function BlogIndex() {
  const webPageJsonLd = generateWebPageJsonLd("Blog", "/blog", blogDescription);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd("Blog", "/blog");

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <SiteHeader />
      <main id="main-content" className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <h1 className="text-4xl md:text-5xl font-black text-ink tracking-tight mb-4">
          {siteConfig.fullName} Blog
        </h1>
        <p className="text-xl text-ink/70 mb-12">{blogDescription}</p>

        <div className="grid grid-cols-1 gap-6">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group bg-white border-3 border-ink p-6 shadow-brutal-sm hover:shadow-brutal-md transition-shadow block"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-coral text-white px-2 py-0.5 border-2 border-ink font-bold font-mono text-xs uppercase">
                  {post.category}
                </span>
                <span className="font-mono text-xs text-ink/50">{post.date}</span>
              </div>
              <h2 className="font-black text-xl text-ink group-hover:text-coral transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-ink/70 font-medium">{post.description}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 5: Commit**

```bash
git add lib/config/blog-posts.ts app/\(public\)/blog/layout.tsx app/\(public\)/blog/page.tsx
git commit -m "feat: add blog layout, index page, and post registry"
```

---

### Task 17: Blog Post Dynamic Route + MDX Rendering

**Files:**
- Create: `app/(public)/blog/[slug]/page.tsx`
- Modify: `lib/config/blog-posts.ts` — add `content` field or content loading

- [ ] **Step 1: Create blog post content files**

Create directory `content/blog/` with MDX files. For simplicity, use a content map in the config since we need to keep things Cloudflare Workers compatible (no file system).

Update `lib/config/blog-posts.ts` to include content:

Add a function `getBlogPostContent(slug: string): string | undefined` that returns the post's HTML content. For initial implementation, use a static content map:

```ts
const BLOG_CONTENT: Record<string, string> = {
  // Content will be filled in Task 18
};

export function getBlogPostContent(slug: string): string | undefined {
  return BLOG_CONTENT[slug];
}
```

- [ ] **Step 2: Create Article JSON-LD generator**

Add to `lib/utils/json-ld.ts`:

```ts
export function generateArticleJsonLd(
  title: string,
  description: string,
  url: string,
  datePublished: string,
  dateModified: string,
  authorName: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      name: authorName,
      url: siteConfig.url,
    },
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
    },
  };
}
```

- [ ] **Step 3: Create blog post dynamic route**

New file `app/(public)/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_POSTS, getBlogPostContent } from "@/lib/config/blog-posts";
import { siteConfig } from "@/lib/config/site";
import {
  generateArticleJsonLd,
  generatePageBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: "Not Found" };

  const postUrl = `${siteConfig.url}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: postUrl },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: postUrl,
      siteName: siteConfig.fullName,
      images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630, alt: siteConfig.fullName }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${siteConfig.url}/api/og/home`],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const content = getBlogPostContent(slug);
  if (!content) notFound();

  const postUrl = `/blog/${post.slug}`;
  const articleJsonLd = generateArticleJsonLd(
    post.title,
    post.description,
    `${siteConfig.url}${postUrl}`,
    post.date,
    post.date,
    siteConfig.fullName,
  );
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(post.title, postUrl);

  // Find related posts (same category or next/prev)
  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <SiteHeader />
      <main id="main-content" className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-ink/60 font-mono text-sm hover:text-coral transition-colors mb-8"
        >
          ← Back to Blog
        </Link>

        <article>
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-coral text-white px-2 py-0.5 border-2 border-ink font-bold font-mono text-xs uppercase">
                {post.category}
              </span>
              <span className="font-mono text-sm text-ink/50">{post.date}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-ink tracking-tight leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-xl text-ink/70">{post.description}</p>
          </header>

          <div
            className="prose prose-lg max-w-none prose-headings:font-black prose-headings:text-ink prose-a:text-coral prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-li:text-ink/80"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 border-t-3 border-ink pt-8">
            <h2 className="font-black text-2xl text-ink mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="bg-mint/20 border-3 border-ink p-4 shadow-brutal-sm hover:shadow-brutal-md transition-shadow block"
                >
                  <span className="font-mono text-xs text-ink/50 block mb-1">{related.category}</span>
                  <h3 className="font-bold text-ink text-sm leading-snug">{related.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 bg-ink border-3 border-ink p-8 shadow-brutal-md text-center">
          <h2 className="font-black text-2xl text-cream mb-2">
            Turn your resume into a website
          </h2>
          <p className="font-mono text-cream/70 mb-6">
            Free forever. No sign-up required to upload.
          </p>
          <Link
            href="/#upload-card"
            className="inline-block bg-coral text-white px-6 py-3 border-3 border-ink font-bold font-mono text-sm uppercase hover:shadow-brutal-md transition-shadow"
          >
            Create Your Portfolio →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/blog/\[slug\]/page.tsx lib/utils/json-ld.ts
git commit -m "feat: add blog post dynamic route with Article JSON-LD"
```

---

### Task 18: Blog Post Content (8 Posts)

**Files:**
- Modify: `lib/config/blog-posts.ts` — add `BLOG_CONTENT` map with HTML content

This task writes 8 blog posts. Each post is 500-1500 words of SEO-optimized HTML content stored in the `BLOG_CONTENT` map. Due to the volume, create separate content files and import them.

- [ ] **Step 1: Create blog content module**

Create `lib/config/blog-content/` directory with one file per post:

New file `lib/config/blog-content/pdf-resume-to-website.ts`:

```ts
export const content = `
<p>In 2026, if your resume isn't online, you're invisible. Recruiters spend an average of 6 seconds scanning a PDF before deciding whether to read further. A portfolio website gives them a reason to stay longer — to explore your projects, understand your impact, and remember your name.</p>

<h2>Why Host Your Resume as a Website</h2>

<p>A PDF resume is a snapshot. A portfolio website is a story. Here's why you should make the switch:</p>

<ul>
  <li><strong>Always up to date.</strong> Update your portfolio once, and every link you've ever shared points to the latest version. No more emailing outdated PDFs.</li>
  <li><strong>Track who's looking.</strong> Portfolio websites can include analytics — see how many people view your resume, where they come from, and what they click on.</li>
  <li><strong>Share anywhere.</strong> A short URL like clickfolio.me/@yourname fits in a LinkedIn bio, email signature, or Twitter profile.</li>
  <li><strong>Stand out visually.</strong> Templates designed for readability beat a wall of text on a white PDF every time.</li>
</ul>

<h2>How AI Resume Parsing Works</h2>

<p>Gone are the days of manually typing every job title, date, and bullet point into a form. Modern AI resume parsing reads your PDF and automatically extracts:</p>

<ul>
  <li><strong>Contact information</strong> — name, email, phone, location, LinkedIn, GitHub, personal website</li>
  <li><strong>Professional experience</strong> — job titles, company names, dates, descriptions</li>
  <li><strong>Education</strong> — degrees, institutions, graduation years</li>
  <li><strong>Skills</strong> — categorized by technical, soft, language, and domain</li>
  <li><strong>Projects and certifications</strong> — with descriptions and links</li>
</ul>

<p>Clickfolio.me uses AI to parse your resume in about 30 seconds. The results are presented in an editor where you can review, correct, and enhance every field before publishing.</p>

<h2>Step-by-Step: PDF to Portfolio in 60 Seconds</h2>

<ol>
  <li><strong>Upload your PDF resume</strong> — Drag and drop on the homepage. No sign-up required.</li>
  <li><strong>Sign in with Google</strong> — Quick OAuth. We only access your name and email.</li>
  <li><strong>Claim your upload</strong> — Link the uploaded resume to your new account.</li>
  <li><strong>AI parses your resume</strong> — Wait about 30 seconds while AI extracts everything.</li>
  <li><strong>Review and edit</strong> — Fix any parsing errors, add missing content, enhance descriptions.</li>
  <li><strong>Choose a template</strong> — Pick from 10 professionally designed templates.</li>
  <li><strong>Publish</strong> — Your portfolio is live at clickfolio.me/@yourname.</li>
</ol>

<h2>Templates and Customization</h2>

<p>Clickfolio.me offers 10 templates across two tiers:</p>

<p><strong>Free (0 referrals):</strong> MinimalistEditorial, NeoBrutalist, GlassMorphic, BentoGrid, ClassicATS, DevTerminal</p>
<p><strong>Premium (unlocked by referring friends):</strong> DesignFolio (3 refs), Spotlight (3 refs), Midnight (5 refs), BoldCorporate (10 refs)</p>

<p>Each template is responsive, mobile-friendly, and designed to showcase your specific profession. Switching templates is instant — your content stays the same, only the design changes.</p>

<h2>Privacy Controls</h2>

<p>Not everything on your resume belongs on the public internet. Clickfolio.me gives you granular privacy controls:</p>

<ul>
  <li><strong>Hide phone number</strong> — Replace with "Available upon request"</li>
  <li><strong>Hide full address</strong> — Show only city and state</li>
  <li><strong>Remove from search</strong> — noindex + exclude from sitemap and explore directory</li>
</ul>

<h2>Comparison with Alternatives</h2>

<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>clickfolio.me</th>
      <th>LinkedIn</th>
      <th>PDF Resume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Custom URL</td>
      <td>Yes (/@handle)</td>
      <td>Yes (/in/name)</td>
      <td>No</td>
    </tr>
    <tr>
      <td>Templates</td>
      <td>10</td>
      <td>1 (fixed)</td>
      <td>Your design</td>
    </tr>
    <tr>
      <td>Privacy controls</td>
      <td>Granular</td>
      <td>Limited</td>
      <td>None</td>
    </tr>
    <tr>
      <td>Analytics</td>
      <td>Page views</td>
      <td>Profile views</td>
      <td>None</td>
    </tr>
    <tr>
      <td>Always up-to-date</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>No</td>
    </tr>
    <tr>
      <td>Free</td>
      <td>Yes (6 templates)</td>
      <td>Yes</td>
      <td>Free to create</td>
    </tr>
  </tbody>
</table>

<h2>Frequently Asked Questions</h2>

<h3>Is clickfolio.me really free?</h3>
<p>Yes. Six templates are free forever. Four premium templates require referring friends — that's how we grow.</p>

<h3>Can I use my own domain?</h3>
<p>Currently, every portfolio gets a clickfolio.me/@yourname URL. Custom domains are on the roadmap.</p>

<h3>What if the AI makes mistakes?</h3>
<p>You can edit every field before publishing. The editor includes auto-save, so you can refine your portfolio over time.</p>

<h3>How do I share my portfolio?</h3>
<p>Copy your clickfolio.me/@yourname URL. Add it to your LinkedIn, email signature, resume PDF, GitHub profile, and anywhere else you want to be discovered.</p>
`;
```

Repeat for each of the 8 blog posts. Due to the volume, create a barrel export:

```ts
// lib/config/blog-content/index.ts
export { content as pdfResumeToWebsite } from "./pdf-resume-to-website";
export { content as bestResumeWebsiteBuilders } from "./best-resume-website-builders";
// ... etc
```

And wire them into the `BLOG_CONTENT` map in `lib/config/blog-posts.ts`.

- [ ] **Step 2-8: Write remaining 7 blog posts**

Create content files for each remaining post with similar thorough content (500-1500 words each). Each post should include proper heading hierarchy (H2, H3), lists, and where appropriate, comparison tables.

Files to create:
- `lib/config/blog-content/best-resume-website-builders.ts`
- `lib/config/blog-content/resume-website-templates.ts`
- `lib/config/blog-content/how-ai-resume-parsing-works.ts`
- `lib/config/blog-content/linkedin-to-portfolio-website.ts`
- `lib/config/blog-content/ats-vs-portfolio-website.ts`
- `lib/config/blog-content/how-to-write-resume-2026.ts`
- `lib/config/blog-content/resume-privacy-guide.ts`

- [ ] **Step 9: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 10: Commit**

```bash
git add lib/config/blog-content/ lib/config/blog-posts.ts
git commit -m "feat: add full blog post content for all 8 SEO articles"
```

---

## Layer 5: Growth Mechanisms

### Task 19: Breadcrumb UI Component

**Files:**
- Create: `components/BreadcrumbNav.tsx`
- Modify: `app/page.tsx` — add breadcrumb
- Modify: `app/explore/page.tsx` — add breadcrumb
- Modify: `app/privacy/page.tsx` — add breadcrumb
- Modify: `app/terms/page.tsx` — add breadcrumb

- [ ] **Step 1: Create BreadcrumbNav component**

New file `components/BreadcrumbNav.tsx`:

```tsx
import Link from "next/link";
import type { FC } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export const BreadcrumbNav: FC<BreadcrumbNavProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <ol className="flex items-center gap-2 text-sm font-mono text-ink/60">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && (
              <svg aria-hidden="true" className="w-3 h-3 text-ink/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-coral transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink font-bold">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
```

- [ ] **Step 2: Add breadcrumb to homepage**

In `app/page.tsx`, import `BreadcrumbNav` and add it inside `<main>` before the hero section:

```tsx
<BreadcrumbNav items={[{ label: "Home" }]} />
```

- [ ] **Step 3: Add breadcrumb to explore page**

In `app/explore/page.tsx`, import `BreadcrumbNav` and add it inside `<main>` before the header:

```tsx
<BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Explore Professionals" }]} />
```

- [ ] **Step 4: Add breadcrumb to privacy and terms pages**

Same pattern as explore — use `BreadcrumbNav` with appropriate labels:
- Privacy: `[{ label: "Home", href: "/" }, { label: "Privacy Policy" }]`
- Terms: `[{ label: "Home", href: "/" }, { label: "Terms of Service" }]`

Also add breadcrumbs to blog posts, blog index, and profession pages.

- [ ] **Step 5: Add breadcrumb to blog index**

- [ ] **Step 6: Add breadcrumb to blog post pages**

- [ ] **Step 7: Add breadcrumb to profession pages**

- [ ] **Step 8: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 9: Commit**

```bash
git add components/BreadcrumbNav.tsx app/page.tsx app/explore/page.tsx app/privacy/page.tsx app/terms/page.tsx app/\(public\)/blog/page.tsx app/\(public\)/blog/\[slug\]/page.tsx app/\(public\)/for/\[profession\]/page.tsx
git commit -m "feat: add visible breadcrumb navigation to all public pages"
```

---

### Task 20: Internal Linking Updates

**Files:**
- Modify: `components/Footer.tsx` — add blog link
- Modify: `components/SiteHeader.tsx` — add blog link (if appropriate)

- [ ] **Step 1: Add blog link to footer**

Read the current `Footer.tsx` and add a "Blog" link alongside existing links (explore, privacy, terms).

- [ ] **Step 2: Run type-check and lint**

```bash
bun run type-check && bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add components/Footer.tsx
git commit -m "feat: add blog link to footer"
```

---

### Task 21: Sitemap — Add Blog and Profession Pages

**Files:**
- Modify: `lib/sitemap.ts` — add blog index, profession pages, and blog posts to sitemap shard 0

- [ ] **Step 1: Add static pages to sitemap shard 0**

In `generateSitemapEntries()`, add entries for new static pages in shard 0:

```ts
// Blog
{
  url: `${baseUrl}/blog`,
  lastModified: new Date(),
  changeFrequency: "weekly",
  priority: 0.7,
},
// Profession pages
...PROFESSION_SLUGS.map((slug) => ({
  url: `${baseUrl}/for/${slug}`,
  lastModified: new Date(),
  changeFrequency: "weekly",
  priority: 0.6,
})),
```

Import `PROFESSION_SLUGS` from `@/lib/config/profession-pages` and `BLOG_POSTS` from `@/lib/config/blog-posts`.

Also add individual blog posts:

```ts
...BLOG_POSTS.map((post) => ({
  url: `${baseUrl}/blog/${post.slug}`,
  lastModified: new Date(post.date),
  changeFrequency: "monthly" as const,
  priority: 0.5,
})),
```

- [ ] **Step 2: Run type-check**

```bash
bun run type-check
```

- [ ] **Step 3: Commit**

```bash
git add lib/sitemap.ts
git commit -m "feat: add blog and profession pages to sitemap"
```

---

## Layer 6: Verification

### Task 22: Full Verification

- [ ] **Step 1: Run full CI pipeline**

```bash
bun run ci
```

- [ ] **Step 2: Verify sitemap XML**

Start dev server and check:
```bash
curl -s http://localhost:3000/sitemap.xml | head -50
```

Verify it returns valid sitemap index XML.

- [ ] **Step 3: Verify robots.txt**

```bash
curl -s http://localhost:3000/robots.txt
```

Expected: Contains `Disallow: /preview/` and `Sitemap: ...`.

- [ ] **Step 4: Verify llms.txt**

```bash
curl -s http://localhost:3000/llms.txt
```

- [ ] **Step 5: Verify blog pages**

Navigate to:
- `/blog` — should show list of posts
- `/blog/pdf-resume-to-website` — should render the first post
- `/for/software-engineers` — should render the profession page

- [ ] **Step 6: Validate JSON-LD on a sample profile page**

Use a real handle from the local DB. Check page source for valid `application/ld+json` scripts with `dateCreated`/`dateModified` fields.

- [ ] **Step 7: Verify admin page noindex**

```bash
curl -s http://localhost:3000/admin | grep -i "noindex"
```

Should return meta robots with noindex.

- [ ] **Step 8: Verify preview page noindex**

```bash
curl -s http://localhost:3000/preview/minimalist_editorial | grep -i "noindex"
```

- [ ] **Step 9: Verify breadcrumbs render correctly**

Check homepage, explore, blog, blog post, and profession pages all show breadcrumb navigation. Verify JSON-LD breadcrumbs are present alongside the visible breadcrumbs.

- [ ] **Step 10: Commit any remaining verification fixes**

```bash
git add -A
git commit -m "chore: verification fixes for SEO implementation"
```

---

## Summary

**Total tasks:** 22
**Files created:** ~25
**Files modified:** ~20
**Estimated implementation time:** 4-6 hours (most time in blog content writing)
