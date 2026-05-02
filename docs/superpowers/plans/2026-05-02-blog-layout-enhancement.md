# Blog Layout Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve blog readability with better spacing, contrast, and visual hierarchy across all blog posts

**Architecture:** Update shared BlogPostLayout component with enhanced prose styling, create HighlightBlock and StatsGrid components for visual callouts, pilot components on AI accuracy post

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui patterns, neubrutalist design system

**Spec Reference:** `docs/superpowers/specs/2026-05-02-blog-layout-enhancement.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `components/blog/HighlightBlock.tsx` | Create | Reusable callout component with variants (tip, stat, warning) |
| `components/blog/StatsGrid.tsx` | Create | Grid component for displaying numerical data |
| `components/blog/BlogPostLayout.tsx` | Modify | Update prose styling: contrast, spacing, heading hierarchy |
| `app/blog/ai-resume-parsing-accuracy/page.tsx` | Modify | Pilot StatsGrid usage for accuracy metrics |

---

## Task 1: Create HighlightBlock Component

**Files:**
- Create: `components/blog/HighlightBlock.tsx`
- Test: `bun run type-check && bun run lint`

- [ ] **Step 1: Create component file with full implementation**

```tsx
import type { LucideIcon } from "lucide-react";
import { Lightbulb, BarChart3, AlertTriangle, Info } from "lucide-react";

interface HighlightBlockProps {
  children: React.ReactNode;
  variant?: "default" | "tip" | "stat" | "warning";
  title?: string;
}

const variantStyles = {
  default: {
    bg: "bg-cream",
    border: "border-ink",
    iconColor: "text-ink",
    Icon: Info,
  },
  tip: {
    bg: "bg-mint/10",
    border: "border-mint",
    iconColor: "text-mint",
    Icon: Lightbulb,
  },
  stat: {
    bg: "bg-coral/10",
    border: "border-coral",
    iconColor: "text-coral",
    Icon: BarChart3,
  },
  warning: {
    bg: "bg-amber/10",
    border: "border-amber",
    iconColor: "text-amber",
    Icon: AlertTriangle,
  },
};

export function HighlightBlock({
  children,
  variant = "default",
  title,
}: HighlightBlockProps) {
  const { bg, border, iconColor, Icon } = variantStyles[variant];

  return (
    <div
      className={`${bg} border-3 ${border} shadow-brutal-sm p-6 my-8`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          {title && (
            <h4 className="font-bold text-ink mb-2">{title}</h4>
          )}
          <div className="text-ink/85 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check and lint**

```bash
bun run type-check
```
Expected: No TypeScript errors

```bash
bun run lint
```
Expected: No Biome errors

- [ ] **Step 3: Commit**

```bash
git add components/blog/HighlightBlock.tsx
git commit -m "feat(blog): add HighlightBlock component for visual callouts

Create reusable callout component with 4 variants:
- default: neutral styling
- tip: mint accent for helpful advice
- stat: coral accent for data/metrics
- warning: amber accent for cautions

Supports optional title prop and uses neubrutalist
border/shadow styling consistent with design system."
```

---

## Task 2: Create StatsGrid Component

**Files:**
- Create: `components/blog/StatsGrid.tsx`
- Test: `bun run type-check && bun run lint`

- [ ] **Step 1: Create component file with full implementation**

```tsx
interface StatItem {
  value: string;
  label: string;
  percentage?: number;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 1 | 2;
}

export function StatsGrid({ stats, columns = 2 }: StatsGridProps) {
  const gridCols = columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`grid ${gridCols} gap-4 my-8`}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-cream border-3 border-ink shadow-brutal-sm p-5"
        >
          <div className="font-black text-3xl text-ink mb-1">
            {stat.value}
          </div>
          <div className="text-sm text-ink/70 font-medium">
            {stat.label}
          </div>
          {stat.percentage !== undefined && (
            <div className="mt-3">
              <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-coral rounded-full"
                  style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run type check and lint**

```bash
bun run type-check
```
Expected: No TypeScript errors

```bash
bun run lint
```
Expected: No Biome errors

- [ ] **Step 3: Commit**

```bash
git add components/blog/StatsGrid.tsx
git commit -m "feat(blog): add StatsGrid component for data visualization

Create grid component for displaying numerical stats with:
- Responsive 1-2 column layout
- Neubrutalist card styling (border-3, shadow-brutal-sm)
- Optional percentage bar visual indicator
- Large bold values with descriptive labels

Supports any number of StatItem objects with value, label,
and optional percentage for progress bars."
```

---

## Task 3: Update BlogPostLayout with Enhanced Typography

**Files:**
- Modify: `components/blog/BlogPostLayout.tsx` (prose styling changes)
- Test: Manual verification + `bun run type-check`

- [ ] **Step 1: Read current file to understand existing prose classes**

Current prose className at line 146:
```tsx
<div className="prose max-w-none prose-headings:text-ink prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-ink/70 prose-p:leading-relaxed prose-li:text-ink/70 prose-strong:text-ink prose-a:text-coral prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-coral prose-blockquote:pl-4 prose-blockquote:text-ink/60 prose-blockquote:italic">
```

- [ ] **Step 2: Update prose className with new spacing and contrast**

Replace the entire prose className (line 146) with:

```tsx
<div className="prose max-w-none
  /* Headings */
  prose-headings:text-ink prose-headings:font-bold
  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b-2 prose-h2:border-ink prose-h2:pb-4
  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
  
  /* Paragraphs - increased contrast and line-height */
  prose-p:text-ink/85 prose-p:leading-[1.8]
  
  /* Lists - increased spacing */
  prose-ul:space-y-3 prose-ol:space-y-3
  prose-li:text-ink/85
  
  /* Emphasis and links */
  prose-strong:text-ink prose-strong:font-bold
  prose-a:text-coral prose-a:no-underline hover:prose-a:underline
  
  /* Blockquotes - enhanced styling */
  prose-blockquote:border-l-4 prose-blockquote:border-coral prose-blockquote:pl-6
  prose-blockquote:py-2 prose-blockquote:bg-ink/5 prose-blockquote:text-ink/80
  prose-blockquote:italic prose-blockquote:rounded-r-lg
">
```

- [ ] **Step 3: Add section spacing via wrapper div styling**

Add this CSS-in-JS style block after the JSON-LD scripts (around line 96, before `<header>`):

```tsx
<style jsx>{`
  article section {
    margin-bottom: 4rem;
  }
  article section:last-child {
    margin-bottom: 0;
  }
`}</style>
```

Or alternatively, if `jsx` style doesn't work with vinext/Cloudflare Workers, add a global style class approach by wrapping the children in a div with a specific class and adding CSS utility:

Change line 145 from:
```tsx
<div className="bg-cream border-3 border-ink shadow-brutal-md p-8 sm:p-12">
```

To:
```tsx
<div className="bg-cream border-3 border-ink shadow-brutal-md p-8 sm:p-12 [&_section]:mb-16 [&_section:last-child]:mb-0">
```

- [ ] **Step 4: Run type check**

```bash
bun run type-check
```
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add components/blog/BlogPostLayout.tsx
git commit -m "feat(blog): enhance typography and spacing across all posts

Update BlogPostLayout prose styling:
- Increase text contrast: 70% -> 85% opacity
- Increase line-height: relaxed -> 1.8
- Add section spacing: 64px (mb-16) between sections
- Increase list spacing: space-y-3 between items
- Add H2 underline separator: border-b-2 border-ink pb-4
- Enhance blockquotes: background tint, more padding
- Use Tailwind arbitrary variants for section spacing

All blog posts automatically benefit from these changes."
```

---

## Task 4: Pilot StatsGrid on AI Resume Parsing Post

**Files:**
- Modify: `app/blog/ai-resume-parsing-accuracy/page.tsx`
- Test: `bun run dev` and manual verification at `http://localhost:3000/blog/ai-resume-parsing-accuracy`

- [ ] **Step 1: Add import for StatsGrid component**

Add to imports at top of file (line 3):
```tsx
import { StatsGrid } from "@/components/blog/StatsGrid";
```

- [ ] **Step 2: Replace accuracy list with StatsGrid component**

Current code at lines 83-124 (The Results section with list items). Replace lines 89-123 (the entire `<ul>` block) with:

```tsx
<StatsGrid
  stats={[
    { value: "100%", label: "Names — reliably extracted every time", percentage: 100 },
    { value: "98%", label: "Contact info — email, phone, location", percentage: 98 },
    { value: "97%", label: "Education — schools, degrees, dates", percentage: 97 },
    { value: "96%", label: "Professional summary", percentage: 96 },
    { value: "95%", label: "Certifications — when in dedicated section", percentage: 95 },
    { value: "93%", label: "Experience — job titles, dates, bullets", percentage: 93 },
    { value: "92%", label: "Languages — proficiency levels", percentage: 92 },
    { value: "90%", label: "Skills — comma-separated lists work best", percentage: 90 },
  ]}
/>
```

- [ ] **Step 3: Remove duplicate intro sentence if needed**

The paragraph before the list (lines 85-88) can stay as-is, but consider whether the intro to the list still makes sense. The current text:

```tsx
<p>
  Overall, the AI parser achieved <strong>94.3% accuracy</strong> on field-level extraction.
  That number breaks down like this:
</p>
```

This works well as context before the StatsGrid.

- [ ] **Step 4: Run type check and lint**

```bash
bun run type-check && bun run lint
```
Expected: No errors

- [ ] **Step 5: Verify in browser**

```bash
bun run dev
```

Navigate to `http://localhost:3000/blog/ai-resume-parsing-accuracy`

Verify:
- Stats display in a 2-column grid on desktop
- Each stat has large number, label, and progress bar
- Cards have neubrutalist borders and shadows
- Mobile view shows single column

- [ ] **Step 6: Commit**

```bash
git add app/blog/ai-resume-parsing-accuracy/page.tsx
git commit -m "feat(blog): pilot StatsGrid on AI accuracy post

Replace accuracy metrics bullet list with StatsGrid component:
- Visual 2-column grid layout
- Large bold percentage values
- Progress bar indicators
- Neubrutalist card styling

Improves scannability of 8 accuracy metrics."
```

---

## Task 5: Verification and Final Review

- [ ] **Step 1: Run full pre-push validation**

```bash
bun run type-check && bun run lint && bun run test:unit
```

Expected: All checks pass

- [ ] **Step 2: Verify all blog posts have improved styling**

Visit these URLs and confirm enhanced typography:
- `http://localhost:3000/blog/pdf-resume-to-website` — check spacing and contrast
- `http://localhost:3000/blog/best-resume-website-builders` — check H2 underline separators
- `http://localhost:3000/blog` — listing page (no changes expected, but verify no regressions)

- [ ] **Step 3: Document what changed**

All blog posts now have:
- Better text contrast (85% vs 70%)
- More breathing room between sections (64px)
- Improved list spacing (12px between items)
- Visual H2 separators (underline border)
- Enhanced blockquote styling

- [ ] **Step 4: Final commit (if any additional changes)**

If no additional changes needed, mark complete.

---

## Spec Coverage Check

| Spec Requirement | Implementation Task | Status |
|------------------|---------------------|--------|
| Text contrast: 70% → 85% opacity | Task 3, prose class update | ✅ Covered |
| Section spacing: 64px (mb-16) | Task 3, [&_section] variant | ✅ Covered |
| List spacing: 12px (space-y-3) | Task 3, prose class update | ✅ Covered |
| H2 underline separator | Task 3, prose-h2:border-b-2 | ✅ Covered |
| HighlightBlock component | Task 1 | ✅ Covered |
| StatsGrid component | Task 2 | ✅ Covered |
| AI accuracy post uses StatsGrid | Task 4 | ✅ Covered |
| Preserve neubrutalist design | All tasks use existing tokens | ✅ Covered |
| No breaking changes | Only additions to prose styling | ✅ Covered |
| Accessibility (contrast meets WCAG) | 85% on cream meets AA for large text | ✅ Covered |

---

## Definition of Done

- [ ] `HighlightBlock` component created with 4 variants
- [ ] `StatsGrid` component created with responsive grid
- [ ] `BlogPostLayout` prose styling updated with enhanced contrast and spacing
- [ ] AI accuracy post displays metrics in StatsGrid instead of bullet list
- [ ] All blog posts show improved typography (verified manually)
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run test:unit` passes (or at least no new failures)

---

## Notes for Implementation

**Design System Compliance:**
- All borders use `border-3` (standard neubrutalist thickness)
- All shadows use `shadow-brutal-sm` or `shadow-brutal-md`
- Colors: cream (#FDF8F3), ink (#0D0D0D), coral (#D94E4E), mint (#4ECDC4), amber (#FFB84D)
- Typography: Use `font-black` for headlines, `font-bold` for emphasis

**Cloudflare Workers Constraints:**
- No issues expected — these are all client-side React/Tailwind changes
- No D1/database access in these components
- No server-side rendering dependencies

**File Naming:**
- Components use PascalCase
- Props interfaces exported for potential reuse
- Follow existing patterns in `components/blog/`

**Testing Strategy:**
- Manual browser verification is primary (visual changes)
- Type checking and linting catch code issues
- Unit tests not required for presentational components
