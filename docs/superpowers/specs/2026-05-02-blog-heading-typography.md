# Spec: Fix Blog Post Heading Typography

**Status:** Awaiting approval  
**Type:** Bug fix / Enhancement  
**Scope:** Blog post pages  
**Priority:** Medium

## Problem Statement

The heading "When to Use a PDF Resume" on the `/blog/pdf-resume-vs-portfolio` page appears as plain text instead of a styled heading. This is inconsistent with the intended design where section headings should have:
- Larger font size (text-2xl)
- Bold weight
- Bottom border (border-b-2)
- Proper spacing (mt-12, mb-6, pb-4)

![Issue Screenshot](user-provided-image)

## Root Cause Analysis

1. The `BlogPostLayout` component at `components/blog/BlogPostLayout.tsx` uses Tailwind Typography plugin classes (`prose-h2:*`)
2. The `@tailwindcss/typography` plugin is **not installed** in the project
3. Tailwind CSS v4.2.4 is installed, but the typography plugin was never added
4. Without the plugin, `prose-*` classes have no effect, causing headings to render with browser defaults

## Requirements

### Functional Requirements
- [ ] Install `@tailwindcss/typography` plugin compatible with Tailwind CSS v4
- [ ] Configure the plugin in `app/globals.css` following Tailwind v4 syntax
- [ ] Verify all `<h2>` elements in blog posts render with proper styling
- [ ] Ensure existing prose classes work as intended

### Design Requirements (from ui-ux-pro-max skill)
- [ ] Maintain consistent heading hierarchy (h1→h2→h3) across blog posts
- [ ] Ensure contrast ratio meets WCAG 4.5:1 for text readability
- [ ] Preserve the brutalist design aesthetic (borders, shadows, ink/cream color scheme)

### Affected Pages
All blog posts using `BlogPostLayout`:
- `/blog/pdf-resume-vs-portfolio`
- `/blog/resume-writing-tips`
- `/blog/ai-resume-parsing-accuracy`
- `/blog/clickfolio-templates-showcase`
- `/blog/pdf-resume-to-website`
- `/blog/best-resume-website-builders`
- `/blog/privacy-at-clickfolio`
- `/blog/linkedin-to-portfolio`

## Technical Details

### Current State
```tsx
// BlogPostLayout.tsx line 147-159
<div
  className="prose max-w-none
  prose-headings:text-ink prose-headings:font-bold
  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b-2 prose-h2:border-ink prose-h2:pb-4
  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
  ...
"
>
```

### Tailwind v4 Configuration
The project uses Tailwind CSS v4.2.4 with the new `@theme inline` configuration in `app/globals.css`. The typography plugin must be imported following v4 syntax.

### Expected Visual Result
- h2 headings: text-2xl (24px), bold, bottom border, proper margins
- Consistent with brutalist design system (ink border color)
- Proper spacing between sections

## Implementation Approach

### Option A: Install @tailwindcss/typography Plugin (Recommended)
**Rationale:**
- Minimal code changes
- Follows existing design intent (prose classes already defined)
- Standard Tailwind ecosystem solution
- Maintains semantic HTML structure

**Steps:**
1. Add `@tailwindcss/typography` to devDependencies
2. Import plugin in `app/globals.css` using Tailwind v4 syntax
3. Build and verify styles are applied

### Option B: Manual CSS Classes on Headings (Not Recommended)
**Rationale:**
- Would require changing all `<h2>` elements in every blog post
- Duplicates styling logic already in BlogPostLayout
- Violates DRY principle

## Validation Plan

1. **Before fix:** Verify headings appear as plain text
2. **After fix:**
   - Visit `/blog/pdf-resume-vs-portfolio`
   - Confirm "When to Use a PDF Resume" has:
     - Bold weight
     - Border-bottom (2px ink color)
     - text-2xl size
     - Proper spacing
   - Check other h2 headings on the page render consistently
   - Verify no visual regressions on other blog posts

## Files to Modify

1. `package.json` - Add `@tailwindcss/typography` to devDependencies
2. `app/globals.css` - Import and configure typography plugin

## Files to NOT Modify

- All blog post page files (`app/blog/*/page.tsx`) - content is correct
- `components/blog/BlogPostLayout.tsx` - classes are already correct
- Any template files

## Definition of Done

- [ ] `@tailwindcss/typography` plugin installed and configured
- [ ] All blog post headings render with proper prose styling
- [ ] No visual regressions on other pages
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] Manual visual verification complete

## References

- [Tailwind CSS Typography Plugin](https://github.com/tailwindlabs/tailwindcss-typography)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4-beta)
- Blog posts pattern: All use `BlogPostLayout` with prose classes
