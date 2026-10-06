# AGENTS.md — clickfolio.me

clickfolio.me turns an uploaded PDF resume into a hosted portfolio at `/@handle`: anon upload → Clerk sign-in → claim → AI parse (Cloudflare Workflow) → publish. It runs as one Cloudflare Worker: [vinext](https://github.com/cloudflare/vinext) (Next App Router on Vite) + React 19, Postgres (PlanetScale) via Hyperdrive + Drizzle, R2, Workflows, one Durable Object, Clerk auth (`@clerk/react` + `@clerk/backend`, **not** `@clerk/nextjs`). Toolchain is Vite+ (`vp`): Oxlint + Oxfmt + Vitest behind one CLI. Product/self-hosting docs: [README.md](README.md). Issues: `gh` on `Divkix/clickfolio.me`.

When you change something this file describes, update it in the same commit.

## Commands

Use the Node version in `.node-version` and pnpm 12.6.0.

| Task                  | Command                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install               | `pnpm install` (runs `vp config` → installs git hooks)                                                                                                 |
| Dev (:3000)           | `pnpm run dev` — needs Hyperdrive env var, see Gotchas                                                                                                 |
| Build                 | `pnpm run build` → `dist/`                                                                                                                             |
| Worker preview        | `pnpm run preview` (build + `wrangler dev`)                                                                                                            |
| Lint + format + types | `pnpm run check` (`vp check`); autofix `pnpm run fix`                                                                                                  |
| Typecheck only        | `pnpm run type-check`                                                                                                                                  |
| Full gate             | `pnpm run verify` (`check` + `type-check` + `knip` unused exports/deps)                                                                                |
| All tests             | `pnpm run test` (integration and security projects)                                                                                                    |
| One suite             | `pnpm run test:integration` / `test:security`                                                                                                          |
| One file              | `pnpm run test tests/integration/claim-flow.test.ts`                                                                                                   |
| One test by name      | `pnpm run test -t "claim"`                                                                                                                             |
| Suites with coverage  | `pnpm run test:coverage` (CI; integration/security baseline thresholds in `vite.config.ts`)                                                            |
| DB migration          | `pnpm run db:generate` then `db:migrate` (needs `DATABASE_URL`)                                                                                        |
| Regenerate env types  | `pnpm run cf-typegen` → `lib/cloudflare-env.d.ts`                                                                                                      |
| Deploy                | `pnpm run deploy` (`scripts/deploy.ts`: build → `db:migrate` → R2 lifecycle → `wrangler deploy`; needs `DATABASE_URL`; `--dry-run` skips side effects) |

## Repo map (non-obvious parts only)

```
worker/index.ts        real Worker entry: scanner-probe 404s → WS /ws/resume-status → vinext;
                       also scheduled() cron + re-exports Workflow classes
proxy.ts               edge gate (replaces middleware.ts): __session presence check
lib/resume/            single owners: lifecycle.ts (status/retry rules), claim-intake.ts, completion.ts
lib/parse/pipeline.ts  Workflow step bodies (must be replay-safe)
lib/workflows/         Workflow classes + start/trigger helpers (parse, R2 delete)
lib/durable-objects/   ClickfolioStatusDO (hibernation WebSocket status push)
lib/stubs/             stubs for CF-incompatible modules (test aliases in vite.config.ts)
lib/seo/               sitemap, llms.txt generators, IndexNow, lastmod.json
lib/examples/          EXAMPLE_GALLERIES: hand-picked directory handles for /examples/<slug>
components/templates/  portfolio themes; registry in lib/templates/
app/(protected)/       user pages — each page gates itself (layout does NOT)
app/(admin)/admin/     admin pages; layout gates via requireAdminAuth
app/preview/[id]/      demo-data renders of themes (thumbnail source), no DB
migrations_pg/         drizzle-kit output — generated, don't hand-edit
tools/oxlint/anti-slop vendored lint plugin (see UPSTREAM.md); excluded from tsc
.vite-hooks/pre-commit bump-lastmod → vp staged → verify
```

## Conventions

- **API routes:** wrap in `withUser` / `withAdmin` (`lib/auth/with-auth.ts`, inner-callback form); respond only via `createSuccessResponse` / `createErrorResponse` + `ERROR_CODES` from `lib/utils/security-headers.ts` (they attach `SECURITY_HEADERS`); bound JSON bodies with `validateRequestSize` + `readJsonWithLimit`; validate with a Zod schema from `lib/schemas/`. Reference shape: `app/api/profile/role/route.ts`.
- **Auth layers:** pages call `getServerSession()` (`lib/auth/session.ts`) and `redirect("/")`; APIs use `lib/auth/middleware.ts` / the wrappers. `requireAuthWithUserValidation` returns **404** when the JWT is valid but the user row is missing (webhook lag) — treat as auth failure. Admin checks re-read `isAdmin` from DB every request; `user.role` is career level, never an authz signal.
- **DB:** `getDb(env.HYPERDRIVE)` per invocation, never cached at module scope. Multi-write → `db.transaction`. Postgres `23505` → HTTP 409. Driver: node-postgres (`pg` >= 8.16.3). Raw SQL goes through Drizzle `execute`; results expose `rows` and `rowCount`.
- **Schema:** timestamps are `timestamptz` with `mode:"string"` (ISO strings in app); enum-like columns are `text` + TS union (no PG enums); JSON is `jsonb`, no manual `JSON.parse`.
- **Resume state:** status transitions, retry eligibility and status presentation belong to `lib/resume/lifecycle.ts` — call it rather than re-deriving. Workflow steps use status-guarded `UPDATE … RETURNING` and SQL-side increments so replays are safe.
- **Logging** in worker/workflows/cron: `log(level, msg, fields)` from `lib/utils/log.ts` (JSON lines).
- **Type assertions** need a `// SAFETY:` comment on the line above (lint rule `require-safety-comment-for-type-assertion`); the 18 `anti-slop/*` rules in `vite.config.ts` all run at error — read the rule file in `tools/oxlint/anti-slop/rules/` when one fires.
- **Images:** plain `<img>`, not `next/image`.
- **Tests:** import from `vite-plus/test`, not `vitest`. Pattern: hoisted `vi.mock(...)` at top, then `const { POST } = await import("@/app/api/…/route")` inside the test. Keep mocks typed, following the existing integration/security suites, without `as unknown as`. Projects `integration` and `security` use the Node environment in `vite.config.ts`; select with `--project name`.
- **Commits:** Conventional Commits `type(scope): summary` (see `git log`).

## Gotchas

- **Dev server fails** with "no local hyperdrive connection string" unless `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` is exported in the shell (a line in `.dev.vars` alone is not read for this). Other local secrets: copy `.env.example` → `.dev.vars`.
- **`drizzle-kit` needs `DATABASE_URL`** (direct PlanetScale URL); the Worker never uses it. `db:push` skips migration files — prototyping only.
- **Cascade footgun:** deleting a `resumes` row cascade-deletes that user's `site_data` (the live portfolio).
- **Dual-write:** `user.showInDirectory` must stay in sync with `privacySettings.show_in_directory` (wizard + privacy routes both write). `/explore` reads the column, the sitemap reads `hide_from_search` in the jsonb.
- **`proxy.ts` only checks `__session` cookie presence** (forgeable; `__client` exists even when signed out). Real auth is in pages/APIs.
- **Resume text is stored raw**; React escapes on render. Never HTML-escape before storage (`migrations_pg/0009` had to undo that).
- **Generated files:** `lib/cloudflare-env.d.ts` (`cf-typegen`), `migrations_pg/*`, `lib/seo/lastmod.json` (pre-commit stamps it; `SKIP_LASTMOD=1` for non-content commits).
- **`/llms.txt` and `/llms-full.txt` are route handlers** built from `BLOG_POSTS`, `THEME_METADATA` etc. — a file in `public/` would shadow them.
- **Adding a theme:** follow the chain `THEME_IDS` → `THEME_METADATA` → `themeToShareVariant` + the five maps in `share-variants.ts` (a dark theme also needs a `case` in `getLinkedInIconVariant`, `lib/utils/share-actions.ts`, or its LinkedIn share icon is black on dark) → `TEMPLATE_LOADERS`/`DYNAMIC_TEMPLATES` → demo data → theme maps in `CreateYoursCTA`/`AttributionWidget` → landing-page copy in `lib/templates/theme-pages.ts` (`/templates/<kebab>`; optional `title` for a profession keyword) → `lib/seo/lastmod.json` → `public/previews/<kebab>.webp` (shot at 1280×800@2x from `/preview/<id>` after Google Fonts load, encoded with `sharp` webp q82). `Record<ThemeId,…>` types catch incomplete theme maps. Recommend it for roles via `PROFESSIONS[].themes`. `tests/integration/templates-render.test.ts` renders every theme in `THEME_IDS` against full, minimal, empty-string and oversized resumes, so a new theme is covered automatically; never write the template count into copy, use `TEMPLATE_COUNT`.
- **Profile indexability** (`isIndexableProfile`) also needs ≥ 100 words of resume text; it gates the sitemap, `/explore`, `/examples`, JSON-LD and IndexNow, so test fixtures for indexable profiles need realistic content.
- **Template headings:** `app/globals.css` forces `h1–h4` to `var(--font-display)`, so a template's root font class doesn't reach headings — scope a rule (see `CaseFile.tsx`).
- **Adding a blog post** needs both a `BLOG_POSTS` entry (`lib/blog/posts.ts`) and `app/blog/<slug>/page.tsx` using `getPostBySlug("<slug>")!` at module scope (build throws if they diverge). Titles ≤ 60 chars / descriptions ≤ 160; set `metaTitle` when the H1 is longer.
- **New static route** needs a key in `lib/seo/lastmod.json` and, if public, an entry in `lib/seo/static-pages.ts`.
- **JSON-LD:** always embed via `serializeJsonLd()` (`lib/seo/json-ld.ts`).
- **Toolchain pins:** `vite-plus`, `vitest`, `@vitest/coverage-v8` must stay on the same version in `pnpm-workspace.yaml` catalog + overrides, or `--coverage` aborts. Bump them only via `vp migrate` (dependabot ignores them).
- **Fresh dependency versions are rejected** by `minimumReleaseAge` in `pnpm-workspace.yaml`; add the package to `minimumReleaseAgeExclude` or wait.
- **`ERR_PNPM_OUTDATED_LOCKFILE`** on a clean checkout after touching `catalog:` deps: run `pnpm install --no-frozen-lockfile` once and commit the lockfile.
- **R2 lifecycle:** `deploy.ts` runs `wrangler r2 bucket lifecycle set`, which replaces all rules — keep every rule in `r2-lifecycle.json`.
- **Build warning** `manualChunks option is ignored because the codeSplitting option is specified` means `clientVendorSplit()` in `vite.config.ts` is currently a no-op.

## Definition of done

1. `pnpm run verify` — lint, format, types, knip (the pre-commit hook runs this too).
2. `pnpm run test` — or the suite(s) covering your change; CI runs integration and security together with `--coverage` and enforces their baseline thresholds.
3. `pnpm run build` when touching config, `worker/`, routes, or dependencies.
4. Schema change → `db:generate` output committed under `migrations_pg/`.
5. This file updated if you changed anything it documents.
