# AGENTS.md — clickfolio.me

Uploaded PDF resume → hosted portfolio at `/@handle`. One Cloudflare Worker: TanStack Start +
React 19, Postgres (PlanetScale) via Hyperdrive + Drizzle, R2, Workflows, a Durable Object, Clerk.
Toolchain is Vite+ (`vp`). Commands: `package.json` scripts. Self-hosting and deploy: `README.md`.

This file holds pointers and traps only; behaviour is documented in the owning module's header.
Edit this file only when a pointer or trap here becomes wrong.

## Done

- `pnpm run verify` + `pnpm run test`. The pre-commit hook also runs `verify`.
- Add `pnpm run build` when touching config, `worker/`, routes, dependencies, or anything client
  code imports: the build runs Start's import protection.
- Schema change → `pnpm run db:generate`, commit `migrations_pg/` (CI fails on drift).
- Writing or reviewing server I/O, routes, auth, logging or tests → `CODING_STANDARDS.md`.

## Where things live

- `worker/index.ts`: the real Worker entry (request routing, crons, queue consumer).
  `worker/cached-pages.ts` is the only cache-enabled entrypoint.
- `app/routes/`: file routes; `api/**` server routes, `_protected/` owner pages, `admin/`.
- `lib/effect/`: server Effect kit; `edges.ts` is where Effects run, `services/` one per dependency.
- `lib/resume/lifecycle.ts`: resume status, retry and sweep rules. Read its header before
  touching claim, parse, completion or the stranded sweep.
- `lib/parse/` + `lib/workflows/`: the parse Workflow; step bodies must be replay-safe.
- `lib/cache/edge-cache.ts`: edge cache and purge model.
- `lib/templates/theme-ids.ts`: adding or removing a theme (header lists the chain).
- `tools/oxlint/anti-slop/`: custom lint rules; when one fires, read its rule file.
- Generated, never hand-edited: `migrations_pg/`, `app/routeTree.gen.ts`,
  `lib/cloudflare-env.d.ts` (`pnpm run cf-typegen`), `lib/seo/lastmod.json` (stamped by
  pre-commit; `SKIP_LASTMOD=1` for non-content commits).

## Traps

- Dev server needs `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` exported in the
  shell; `.dev.vars` is not read for it. Other local secrets: `.env.example` → `.dev.vars`.
- `drizzle-kit migrate/push/studio` need `DATABASE_URL`; `generate` runs offline.
- Route files ship to the client, and `loader`/`beforeLoad`/`head` run there too: `env`, Effect
  and DB work go inside `createServerFn(...).handler` or `server.handlers`.
- `[import-protection] Import denied` at build: follow the trace to the client-reachable import.
  `dev` only mocks it (`Mocked import used in dev client` in the console).
- `Rolldown failed to resolve import "cloudflare:workers"`: `env` read outside a server boundary;
  pattern `lib/utils/log.ts` (`createIsomorphicFn().server`).
- `app/routes/_protected/` pages gate themselves (`getServerSession` → `redirect`); the layout
  never redirects.
- Public pages are shared edge-cached renders: read the session client-side (`OwnerDetector`);
  after a data change call `revalidatePublicProfilePages` (`lib/utils/revalidate.ts`).
- Deleting a `users` row cascades to `site_data`, the live portfolio. Deleting a `resumes` row
  does not.
- `user.showInDirectory` and `privacySettings.show_in_directory` are a dual write (wizard and
  privacy routes): `/explore` reads the column, the sitemap reads the jsonb.
- Every write of `site_data.content` spreads `siteDataContentColumns(content)`. Indexable-profile
  fixtures need real content (`INDEXABLE_CONTENT` in `tests/helpers/pglite-db.ts`).
- Resume text is stored raw; React escapes on render (`migrations_pg/0009` undid escaping).
- Template fonts load only through `TemplateFontLinks`. Cloudflare Fonts rewrites Google Fonts
  `<link>`s in production only, breaking hydration (React #418) where dev and preview look fine.
- `app/globals.css` forces `h1–h4` to `var(--font-display)`; a template scopes its own heading
  rule (`CaseFile.tsx`).
- `/llms.txt` and `/llms-full.txt` are route handlers; a file in `public/` would shadow them.
- New static route: key in `lib/seo/lastmod.json`; if public, an entry in `lib/seo/static-pages.ts`.
- `r2-lifecycle.json` holds every R2 lifecycle rule: deploy's `lifecycle set` replaces them all.
- `vite-plus`, the `vite` alias, `vitest` and `@vitest/coverage-v8` move together through the
  `pnpm-workspace.yaml` catalog. `ERR_PNPM_OUTDATED_LOCKFILE` after a catalog change →
  `pnpm install --no-frozen-lockfile`, commit the lockfile.
- Renaming a CI job: update `EXPECTED_CHECKS` in `.github/workflows/dependabot-automerge.yml`.
- After rolling back to a Worker older than `site_data.content_indexable`, run
  `pnpm run db:backfill-indexable --since <rollback time>` once the new code is back.
- `/otel/v1/*` drops browser telemetry until the `OTEL_BROWSER_INGEST_KEY` secret is set.
