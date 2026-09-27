# design-sync notes — clickfolio.me → Claude Design

Project: https://claude.ai/design/p/49fe7e77-1fea-43fa-8991-4ac1a04f8259 (pinned in `config.json`).

## How this repo is wired (it's an app, not a DS package)

- No `dist/`, no Storybook. `.design-sync/pkg/` is a hand-written **barrel package** (`@clickfolio/ui`, `types`/`module` → `index.ts`) that re-exports the synced components straight from `components/`. `cfg.entry` points at it; add/remove components there.
- Scope (user choice, first sync): `components/ui/*` shadcn primitives + reusable shared app components. Excluded: resume templates, wizard steps, API-bound forms (react-hook-form `Form*`), admin uplot charts, auth/analytics plumbing.
- `.design-sync/pkg/tsconfig.json` `paths` = shims for seams that can't run outside Next/Clerk (exact keys MUST stay above `@/*` — the converter's paths plugin matches in insertion order):
  - `next/link` → plain `<a>`; `next/navigation` → inert router, `usePathname()` = `/dashboard`.
  - `@/lib/auth/client` → signed-out Clerk surface; `@/lib/analytics/client` → no-ops (keeps posthog-js out).
  - `@/components/icons/BrandIcons` → `shims/brand-icons.tsx`: calls the real icons and swaps `/brand/*` root-relative `src` for inlined data URLs (site-root assets don't exist in Claude Design).
- `shims/process-env.ts` is imported FIRST in `index.ts`: `lib/utils/validation.ts` reads `process.env.MAX_UPLOAD_SIZE_MB` (Vite-inlined in the app) → `ReferenceError: process is not defined` killed every preview without it.
- Icons: `pkg/icons.ts` = every lucide icon imported under `app/` + `components/` plus common UI glyphs, exported as the `Icons` namespace (`window.Clickfolio.Icons.Upload`). Full `lucide-react` via `extraEntries` was tried: bundle 1.3 MB → 2.8 MB and a `Badge` name collision — rejected. Regenerate the list by re-running the snippet logic (grep `from "lucide-react"`) when the app adopts new icons.

## CSS (Tailwind 4, compiled here)

- `cfg.buildCmd` = `node .design-sync/build-css.mjs` → compiles `.design-sync/tailwind.css` (imports `app/globals.css`, `@source` components + previews + pkg, plus a large `@source inline(...)` safelist of token-backed utilities) with the repo's `@tailwindcss/postcss`, minified → `.design-sync/pkg/dist/ds.css` (gitignored) = `cfg.cssEntry`.
- **Run buildCmd BEFORE package-build whenever previews change** — a class used only in a preview doesn't exist until the CSS is recompiled. `preview-rebuild.mjs` does NOT refresh CSS.
- `cssEntry` must resolve inside the package dir (`pkg/`) — `../.cache/ds.css` was rejected ("resolves outside the package").
- Fonts: `@fontsource-variable/{hanken-grotesk,bricolage-grotesque,jetbrains-mono}` via `cfg.extraFonts` (package-relative `../../node_modules/...`). `h1–h4` get `--font-display` (Bricolage) from globals base layer.

## Tooling

- Playwright: `.ds-sync` `npm i playwright` (1.63.0 pins chromium 1243, already cached in `~/Library/Caches/ms-playwright`).
- Converter run from repo root: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle`.
- Groups are dir-derived (`ui/` + root components land in `general`); not regrouped.

## Preview authoring

- Import from `"@clickfolio/ui"`; lucide icons may be imported from `lucide-react` in previews (bundled into the preview), but prefer `Icons.X` so the preview mirrors what the design agent can do.
- Overlays: `Dialog` uses `defaultOpen modal={false}` + `overrides.Dialog {cardMode:"single", viewport:"640x420"}`.
- `<details>` open state: set `open` via a ref in `useEffect` (React-injected `<script>` never runs).
- Cell width is ~680px: keep multi-column compositions at 640px or less. Wide admin/app blocks use `cardMode:"column"` (validate's `[GRID_OVERFLOW]` told us which ones).
- Dark mode in a preview: a `<div className="dark bg-background text-foreground">` wrapper. A nested `ThemeProvider` is a no-op (next-themes returns children under a parent provider).
- Blog `PostSection`/`PostList` are bare `h2/p/ul`; previews wrap them in the `prose ...` className from `components/blog/BlogPostLayout.tsx`.
- Self-managed open state (`SharePopover`, `LinkedInExportHelp`): `.click()` the trigger in `useEffect`. `YouAreLiveModal` takes `open`. Radix dialogs: `onOpenAutoFocus={(e) => e.preventDefault()}` avoids a focus ring in the shot.
- `position: fixed` widgets (`SharePopover`, `AttributionWidget`): wrap in `style={{transform:"translateZ(0)"}}` so the wrapper becomes the containing block.
- `CreateYoursCTA` appears after 3s or 30% scroll: fake `scrollY`/`scrollHeight` and dispatch `scroll` on mount. Wrap it in `inline-block`.
- Headless clipboard rejects: stub `navigator.clipboard` in `useEffect` to reach copy "Copied" states.
- `FileDropzone` drag/error states: dispatch native `dragenter` / `drop` (non-PDF File) on the inner button. Uploading/complete need live API, skipped. Modal mode not previewed.
- **sonner:** a preview importing `sonner` gets its own copy (separate toast store). The barrel now exports `toast` (same instance as `Toaster`). The `Toaster` preview still fires via a hidden `CopyLinkButton`; could be simplified to `toast` from `@clickfolio/ui`.
- Skipped static states: `SaveIndicator status="idle"` (renders null), `ThemeToggle` dark-active (would flip the page).

## Generated `.d.ts` (dtsPropsFor)

- Because `pkgDir` is `.design-sync/pkg/` and sources live in `components/`, the converter's `isOwnProp` treats every prop as inherited: it **drops `on[A-Z]` callback props** and leaves local types (`BarItem`, `LucideIcon`, ...) unimported. `cfg.dtsPropsFor` hand-writes the props body for the 13 affected components (CommaArrayInput, FileDropzone, SharePopover, YouAreLiveModal, Pagination, HorizontalBarChart, StatCard, FormSectionCard, StatsGrid, PersonCard, Breadcrumb, FaqAccordion, PostList). **These drift when the source props change; re-check them on every re-sync** (diff against the source `interface ...Props`).
- Still imperfect, accepted: `components/ui` `ref?: React.Ref` (no type arg), DOM props like `onClick`/`disabled` omitted (the agent knows HTML attrs), `Toaster`/`ThemeProvider` reference library types (`ToastOptions`, `ValueObject`, ...), `ExploreHeader` shows an index signature (takes no props).

## Component quirks (source behaviour, not sync bugs)

- `AlertTitle` exists in `components/ui/alert.tsx` but isn't exported, so it isn't synced.
- `ResumeStatusBadge` maps `waiting_for_cache` to "Completed". `Footer` hardcodes "© 2024". `Skeleton` (`bg-muted`) is very faint. `Textarea` uses `field-sizing-content` (`rows` is ignored). `ComparisonTable` outer border looks faint (rounded + collapsed borders).

## Known render warns

- None open. The `[GRID_OVERFLOW]` flags were resolved with column overrides.

## Repo quality gate

- `tsconfig.json` excludes `.design-sync`, `.ds-sync`, `ds-bundle` (previews import `@clickfolio/ui`, which only resolves through `pkg/tsconfig.json`; `ds-bundle/` holds generated `.d.ts`). `vite.config.ts` `SHARED_IGNORE_PATTERNS` has `.design-sync/**`. Knip's `project` globs never included it. Keep AGENTS.md in step if these change.

## Re-sync risks

- **Shim drift:** `pkg/shims/*` mirror the public surface of `next/link`, `next/navigation`, `lib/auth/client.tsx`, `lib/analytics/client.ts`, `components/icons/BrandIcons.tsx`. A synced component that starts using a new export from one of these fails at bundle time (missing export) — add it to the shim.
- **New brand assets:** a new image-based brand icon needs its `/brand/*` src inlined in `shims/brand-icons.tsx` or it renders broken.
- **Icon list:** `pkg/icons.ts` is a curated snapshot. New lucide imports in the app don't reach Claude Design until the list is regenerated.
- **Safelist:** the design agent can only use classes present in the compiled CSS. New tokens in `app/globals.css` need a matching entry in `tailwind.css`'s `@source inline(...)` safelist.
- **Barrel scope:** a new shared component isn't synced until it's exported from `pkg/index.ts` (and gets a preview).
- **`process.env` reads:** any new top-level `process.env.X` read in a synced module is fine (the shim yields `undefined`), but code that *requires* the value may throw at load time and blank every card.
