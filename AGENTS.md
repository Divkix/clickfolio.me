# AGENTS.md — clickfolio.me

Uploaded PDF resume → hosted portfolio at `/@handle`: anonymous upload → Clerk sign-in → claim → AI parse in a Cloudflare Workflow → publish. One Cloudflare Worker running TanStack Start + React 19, Postgres (PlanetScale) via Hyperdrive + Drizzle, R2, Workflows, one Durable Object and Clerk. Toolchain: Vite+ (`vp` runs Oxlint, Oxfmt and Vitest). Setup, env vars and deploy: [README.md](README.md).

## Done

- `pnpm run verify` (lint, format, types, knip; the pre-commit hook runs it) and `pnpm run test`, or the covering file: `pnpm run test <path>`. CI runs `pnpm run test:coverage`, whose thresholds in `vite.config.ts` sit at the current baseline, so new code ships with tests.
- `pnpm run build` as well when touching config, `worker/`, routes, dependencies or anything client code imports: only the build runs Start's import protection.
- Schema change: commit the `pnpm run db:generate` output; CI rejects drift. `db:push` bypasses migrations (prototyping only).
- Commit messages: Conventional Commits, `type(scope): summary`.
- Reviewing a diff: apply every rule in [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Where things live

| Concern                                          | Start at                                                  |
| ------------------------------------------------ | --------------------------------------------------------- |
| Request routing, crons, queue consumer           | `worker/index.ts`                                         |
| API route shape                                  | `app/routes/api/profile/role.ts`, `lib/auth/with-auth.ts` |
| Page session                                     | `lib/auth/session.ts`                                     |
| Effect services, layers, edges, tagged failures  | `lib/effect/`                                             |
| Resume status and retry rules                    | `lib/resume/lifecycle.ts`                                 |
| Parse Workflow steps                             | `lib/parse/pipeline.ts`, `lib/workflows/`                 |
| Edge cache and purges                            | `lib/cache/`, `worker/cached-pages.ts`                    |
| Indexability (sitemap, `/explore`, IndexNow)     | `lib/data/indexable-profiles.ts`                          |
| Themes (add/remove checklist above `THEME_IDS`)  | `lib/templates/theme-ids.ts`                              |
| DB schema                                        | `lib/db/schema/`                                          |
| Test helpers: PGlite DB, auth stubs, route calls | `tests/helpers/`                                          |

## Traps

- **Local dev**: `pnpm run dev` needs `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` exported in the shell; a `.dev.vars` line is not read for it. The hosted Clerk webhook can't reach localhost, so a fresh local sign-in has no `users` row and API routes answer 404. `/otel/v1/*` answers 204 and drops data until `OTEL_BROWSER_INGEST_KEY` is set.
- **Client/server split**: route files ship to the browser, and `loader`, `beforeLoad` and `head` run on both sides. Code touching `env`, Effect or the DB belongs in `createServerFn(...).handler` or `server.handlers`. `verify` misses a leak and dev swaps in a mock (browser console: `Mocked import used in dev client`); `pnpm run build` fails with the import trace. `Rolldown failed to resolve import "cloudflare:workers"` is the same leak through `env`.
- **Fonts**: Google Fonts load only through `TemplateFontLinks`. Cloudflare Fonts rewrites `<link rel="stylesheet">` into inline `<style>` at the production edge and breaks hydration (React #418); dev and preview never show it.
- **Edge cache**: an opted-in page's render is shared by every visitor, so it reads the session client-side (like `OwnerDetector`). Purges reach only the entrypoint that sends them: purge through `ctx.exports.CachedPages.purge`.
- **Live data**: deleting a `users` row cascade-deletes their published `site_data`. Every `site_data.content` write spreads `siteDataContentColumns(content)` so the stored indexability flag follows. Resume text is stored raw and React escapes it on render (`migrations_pg/0009_decode_html_escaped_location.sql` undid an escaping bug).
- **Timeouts**: `pg` and bindings ignore abort signals, so a timed-out write may have landed; never retry a timed-out email, queue send, DO notify, R2 put or webhook POST.
- **Locks**: Hyperdrive rejects advisory locks; serialize with `FOR UPDATE` row locks (see `lib/rate-limit/ip.ts`).
- **R2 lifecycle**: deploy replaces every bucket rule with `r2-lifecycle.json`, so keep all rules there.
- **Lockfile**: `ERR_PNPM_OUTDATED_LOCKFILE` after touching `catalog:` deps → run `pnpm install --no-frozen-lockfile` once and commit the lockfile.
- **Generated files**: `migrations_pg/`, `app/routeTree.gen.ts` (committed so `type-check` runs before a build), `lib/cloudflare-env.d.ts` (`pnpm run cf-typegen`), `lib/seo/lastmod.json` (pre-commit stamps it; `SKIP_LASTMOD=1` for commits that change no page content).
- **Lint**: when a rule fires, read its source in `tools/oxlint/anti-slop/`. Client code satisfies the Effect rules with a plain `switch` on its own string union, never by importing `Match`.

## Keeping this file small

Pointers and cross-cutting traps only. A subsystem's rules go in its module header comment, a review-time rule in CODING_STANDARDS.md, a mechanical rule into a lint rule or test.

<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:

- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->
