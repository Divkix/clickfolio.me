# Blog Layout Enhancement Design

**Date:** 2026-05-02  
**Scope:** All blog posts on clickfolio.me  
**Goal:** Improve readability by reducing visual clutter, adding breathing room, and enhancing content hierarchy

---

## Problem Statement

The current blog layout feels "squished" and cluttered:

1. **Low text contrast** — `text-ink/70` is hard to read, especially for long-form content
2. **Dense vertical rhythm** — Sections, paragraphs, and lists lack sufficient spacing
3. **No visual separation** — `<section>` elements blend together without clear breaks
4. **Flat content hierarchy** — Headings don't stand out enough; all content has similar visual weight
5. **Data buried in lists** — Statistics and key metrics get lost in plain text bullet points

---

## Design Solution

### 1. Typography & Spacing Improvements (BlogPostLayout.tsx)

| Element | Current | New |
|---------|---------|-----|
| Paragraph text | `text-ink/70` | `text-ink/85` |
| List item text | Default (low contrast) | `text-ink/85` |
| Section spacing | None | `mb-16` (64px) between sections |
| Paragraph line-height | `leading-relaxed` (1.625) | `leading-[1.8]` |
| List item spacing | Tight | `space-y-3` (12px between items) |
| H2 top margin | `mt-10` | `mt-12` |
| H2 bottom margin | `mb-4` | `mb-6` |
| H2 visual | Plain | `border-b-2 border-ink pb-4` (underline separator) |
| H3 top margin | `mt-8` | `mt-8` (keep) |
| H3 bottom margin | `mb-3` | `mb-4` |

### 2. New Component: HighlightBlock

**Purpose:** Visual callouts for key takeaways, tips, warnings, and important stats

**Design Spec:**
- Border: `border-3 border-ink` (matches neubrutalist theme)
- Background: Cream with subtle tint (`bg-coral/5`, `bg-mint/5`, or `bg-amber/5` based on variant)
- Padding: `p-6` (24px)
- Shadow: `shadow-brutal-sm`
- Optional icon: Lucide icon or emoji positioned at top-left
- Variants:
  - `default` — neutral, cream background
  - `tip` — mint tint, lightbulb icon
  - `stat` — coral tint, chart icon
  - `warning` — amber tint, alert icon

**Usage:** Replace dense bullet lists with HighlightBlocks for key content

### 3. New Component: StatsGrid

**Purpose:** Display numerical data in a scannable, visual format

**Design Spec:**
- Layout: CSS Grid, 2 columns on desktop (`sm:grid-cols-2`), 1 column on mobile
- Gap: `gap-4` (16px)
- Each stat card:
  - Border: `border-3 border-ink`
  - Background: `bg-cream`
  - Shadow: `shadow-brutal-sm`
  - Padding: `p-5`
  - Number: `font-black text-3xl text-ink`
  - Label: `text-sm text-ink/70 font-medium`
  - Optional: subtle progress bar visual for percentages

**Usage:** Replace accuracy metrics lists with StatsGrid in data-heavy posts

### 4. Enhanced Blockquotes

**Current:**
```
border-l-4 border-coral pl-4 text-ink/60 italic
```

**New:**
```
border-l-4 border-coral pl-6 py-2 bg-ink/5 text-ink/80 italic
```

Add subtle background tint and more horizontal padding

---

## Files to Modify

### 1. `components/blog/BlogPostLayout.tsx`
**Changes:**
- Update prose className with new spacing and contrast values
- Add `section` spacing via CSS selector or wrapper div styling
- Update prose-h2, prose-h3, prose-p, prose-ul, prose-li modifiers

### 2. Create `components/blog/HighlightBlock.tsx`
**New file:** Reusable callout component with variants

### 3. Create `components/blog/StatsGrid.tsx`
**New file:** Grid component for displaying stat cards

### 4. `app/blog/ai-resume-parsing-accuracy/page.tsx`
**Changes:**
- Replace accuracy metrics list with `<StatsGrid>` component
- Wrap "Tips for Better Parsing Results" section with `<HighlightBlock variant="tip">`

### 5. `app/blog/pdf-resume-to-website/page.tsx` (example enhancement)
**Changes:**
- Wrap "What Makes a Great Resume Website" checklist with styled callouts

---

## Visual Impact Summary

| Before | After |
|--------|-------|
| Dense wall of text | Generous breathing room between sections |
| 70% opacity (hard to read) | 85% opacity (comfortable reading) |
| Lists crammed together | 12px spacing between items |
| Flat heading hierarchy | H2 with underline separator, stronger visual breaks |
| Stats buried in text | Visual stat cards with neubrutalist borders |
| Generic content blocks | Contextual highlight blocks (tips, stats, warnings) |

---

## Accessibility Considerations

1. **Contrast:** 85% opacity on cream background meets WCAG AA for large text
2. **Spacing:** Increased line-height and section spacing improves readability for all users
3. **Reduced motion:** All spacing changes are static (no animation dependencies)
4. **Semantic HTML:** No changes to underlying element structure

---

## Rollout Strategy

1. **Phase 1:** Update `BlogPostLayout.tsx` prose styling — affects ALL posts immediately
2. **Phase 2:** Create and test `HighlightBlock` and `StatsGrid` components
3. **Phase 3:** Apply new components to data-heavy posts (ai-resume-parsing-accuracy as pilot)
4. **Phase 4:** Gradually enhance other posts using new components where appropriate

---

## Definition of Done

- [ ] Text contrast increased from 70% to 85% opacity across all blog posts
- [ ] Section spacing (64px) creates clear visual breaks between content sections
- [ ] List items have 12px vertical spacing for better scannability
- [ ] H2 headings display with underline separator (`border-b-2`)
- [ ] `HighlightBlock` component created with 4 variants (default, tip, stat, warning)
- [ ] `StatsGrid` component created with responsive 2-column layout
- [ ] AI accuracy post uses `StatsGrid` for metrics
- [ ] All changes preserve existing neubrutalist design language (borders, shadows, colors)
- [ ] No breaking changes to existing blog post content structure
