# Blog Heading Typography Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and configure @tailwindcss/typography plugin to enable prose classes for blog post headings

**Architecture:** Install typography plugin compatible with Tailwind CSS v4, import it in globals.css, build to verify styles apply correctly

**Tech Stack:** Tailwind CSS v4.2.4, @tailwindcss/typography plugin, vinext (Vite-based Next.js)

**Source Spec:** `docs/superpowers/specs/2026-05-02-blog-heading-typography.md`

---

## Prerequisites

- Bun package manager (already configured in repo)
- Working dev server: `bun run dev` serves on port 3000

---

## Files Overview

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `@tailwindcss/typography` to devDependencies |
| `bun.lock` | Auto-generated | Package lockfile (updated by bun install) |
| `app/globals.css` | Modify | Import typography plugin using Tailwind v4 syntax |

---

## Task 1: Install @tailwindcss/typography Plugin

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add typography plugin to devDependencies**

Add this line to the `devDependencies` section of `package.json`:

```json
"@tailwindcss/typography": "^0.5.16",
```

Insert it alphabetically (after `@testing-library/user-event` and before `@types/bun`):

```json
"@testing-library/user-event": "^14.6.1",
"@tailwindcss/typography": "^0.5.16",
"@types/bun": "^1.3.13",
```

- [ ] **Step 2: Install the new dependency**

```bash
bun install
```

Expected output: Package installed successfully, `bun.lock` updated

- [ ] **Step 3: Verify installation**

```bash
cat package.json | grep -A1 -B1 "@tailwindcss/typography"
```

Expected: Shows the plugin with correct version

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add @tailwindcss/typography plugin for blog heading styles"
```

---

## Task 2: Configure Typography Plugin in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add typography plugin import**

Add this import at the top of `app/globals.css`, right after the existing imports:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@tailwindcss/typography";
```

The file should start like this:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@tailwindcss/typography";

@source "../app/**/*.{js,ts,jsx,tsx,mdx}";
@source "../components/**/*.{js,ts,jsx,tsx,mdx}";
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cat app/globals.css | head -10
```

Expected: Shows the three imports at the top

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "config: import @tailwindcss/typography plugin for prose styles"
```

---

## Task 3: Build and Verify Styles Work

**Files:**
- Test: Blog post page to verify visual styling

- [ ] **Step 1: Run type-check to catch any type errors**

```bash
bun run type-check
```

Expected: No TypeScript errors

- [ ] **Step 2: Run lint to catch any style issues**

```bash
bun run lint
```

Expected: No linting errors

- [ ] **Step 3: Build the application**

```bash
bun run build
```

Expected: Build completes successfully without errors

- [ ] **Step 4: Verify the fix visually**

Start dev server and check the blog page:

```bash
bun run dev
```

Then open `http://localhost:3000/blog/pdf-resume-vs-portfolio` in browser.

**Visual Checklist:**
- [ ] "When to Use a PDF Resume" heading appears with:
  - Bold font weight
  - Bottom border (2px, ink color)
  - Larger text size (text-2xl, ~24px)
  - Proper spacing above and below (mt-12, mb-6, pb-4)
- [ ] Other h2 headings on the page ("When to Use a Portfolio Website", "The Hybrid Approach", etc.) have consistent styling
- [ ] h3 headings (if any) render with text-xl size
- [ ] No visual regressions on other blog posts

- [ ] **Step 5: Commit verification**

```bash
git add -A
git commit -m "feat(blog): enable typography plugin for styled headings

- Install @tailwindcss/typography v0.5.16
- Import plugin in globals.css
- All blog post h2 headings now render with proper styling:
  - text-2xl size, bold weight, ink border-bottom
  - Consistent spacing per brutalist design system

Fixes heading inconsistency on /blog/pdf-resume-vs-portfolio"
```

---

## Task 4: Test All Blog Posts

**Files:**
- Test: All blog pages using BlogPostLayout

- [ ] **Step 1: Verify styling on all blog posts**

With dev server running, check these URLs:

1. `http://localhost:3000/blog/pdf-resume-vs-portfolio` - Verify "When to Use a PDF Resume" heading
2. `http://localhost:3000/blog/resume-writing-tips` - Verify "Structure That Works" heading
3. `http://localhost:3000/blog/ai-resume-parsing-accuracy` - Verify h2 headings
4. `http://localhost:3000/blog/clickfolio-templates-showcase` - Verify h2 headings
5. `http://localhost:3000/blog/pdf-resume-to-website` - Verify h2 headings
6. `http://localhost:3000/blog/best-resume-website-builders` - Verify h2 headings
7. `http://localhost:3000/blog/privacy-at-clickfolio` - Verify h2 headings
8. `http://localhost:3000/blog/linkedin-to-portfolio` - Verify h2 headings

**Expected:** All h2 headings render with consistent styling:
- Border-bottom (2px ink)
- Bold weight
- text-2xl size
- Proper spacing

- [ ] **Step 2: Stop dev server**

```bash
# Press Ctrl+C in the terminal running bun run dev
```

---

## Verification Commands

Run these to ensure the implementation is complete:

```bash
# Type checking
bun run type-check

# Linting
bun run lint

# Build verification
bun run build

# Quick grep to confirm plugin is imported
grep "@tailwindcss/typography" app/globals.css

# Quick grep to confirm plugin is in package.json
grep "@tailwindcss/typography" package.json
```

All commands should pass/succeed.

---

## Definition of Done

- [ ] `@tailwindcss/typography` v0.5.16 installed
- [ ] Plugin imported in `app/globals.css`
- [ ] All blog post h2 headings render with proper styling (border, bold, larger size)
- [ ] No visual regressions on other pages
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] Manual verification of `/blog/pdf-resume-vs-portfolio` complete

---

## Rollback Plan

If issues arise:

1. **Revert package.json changes:**
   ```bash
   git checkout package.json
   bun install
   ```

2. **Revert globals.css changes:**
   ```bash
   git checkout app/globals.css
   ```

3. **Restart dev server:**
   ```bash
   bun run dev
   ```

---

## Spec Coverage Check

| Spec Requirement | Plan Task |
|------------------|-----------|
| Install @tailwindcss/typography plugin | Task 1 |
| Configure plugin in globals.css | Task 2 |
| Verify h2 headings render correctly | Task 3 |
| Test all blog posts | Task 4 |
| type-check passes | Task 3 Step 1 |
| lint passes | Task 3 Step 2 |

All requirements covered ✓
