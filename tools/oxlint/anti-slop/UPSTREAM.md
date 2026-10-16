# Vendored anti-slop Oxlint plugin

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit
`13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13, merge of #45 "keep consecutive single-line bindings
grouped in require-readable-spacing"), path `skills/install-anti-slop/assets/anti-slop/`. The local skill
bundle used for the update was compared against that tree: byte-identical.

Merge base: upstream `e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a` (the original install, verified then
byte-for-byte against the upstream blobs). Recover it with
`git archive e6676e8 skills/install-anti-slop/assets/anti-slop` from an upstream clone.

## Local deviation (the only one)

Every `@oxlint/plugins` import specifier is rewritten to `vite-plus/lint/plugins` (commit `6a83c4a7`,
"migrate to vite+ fully") — 50 import lines across all 35 `.ts` files, including the single-quoted import in
`vendor/eslint-stylistic/padding-line-between-statements.ts`. No other upstream byte differs. An earlier
version of this file called the tree pristine after that rewrite; it was not. On the next update, take
incoming files and re-apply the same specifier rewrite (`grep -rn "oxlint/plugins" .` must only hit
Markdown afterwards).

## Update history

- 2026-10-15: `e6676e8` → `13909c9`. Upstream changed three files, all adopted:
  `rules/require-readable-spacing.ts`, `vendor/eslint-stylistic/padding-line-between-statements.ts`
  (new optional `statementTypes` argument) and `vendor/eslint-stylistic/UPSTREAM.md`. The whole snapshot
  is reconciled; remaining differences are the import rewrite above. No rules added or removed, no
  config or dependency change.

Installed paths:

- `index.ts` — generic plugin; registers the 18 rules under `anti-slop/`
- `rules/`, `shared/` — rule implementations and their helpers
- `effect/` — opt-in Effect plugin; **vendored but not registered** (this repository has no direct
  `effect` dependency, so `anti-slop-effect/*` deliberately stays off)
- `vendor/eslint-stylistic/` — `padding-line-between-statements` plus its `LICENSE` and its own
  `UPSTREAM.md`. Keep the license and provenance file with every redistributed copy.
  `require-readable-spacing` imports this rule at runtime and this directory is covered by a `!vendor/`
  negation in the repository `.gitignore`, because a global `vendor/` ignore pattern would otherwise keep
  the rule and both license files out of the repository — a fresh clone would then fail to lint. Keep the
  negation when re-copying the tree.

Registration lives in `vite.config.ts`: `lint.jsPlugins` entry `anti-slop` →
`./tools/oxlint/anti-slop/index.ts`, all 18 generic rules at `"error"`, native companion
`oxc/no-accumulating-spread` at `"error"`, and `tools/oxlint/anti-slop/**` in `SHARED_IGNORE_PATTERNS`
(shared by `lint.ignorePatterns` and `fmt.ignorePatterns`, so neither Oxlint nor Oxfmt writes here).
`tsconfig.json` excludes `tools` because these files are not application source for `tsc --noEmit`.

## Dependency pairing

`index.ts` imports `eslintCompatPlugin` from `vite-plus/lint/plugins`. This repository has no direct
`oxlint` or `@oxlint/plugins` dependency — `vite-plus` depends on both and provides the binary that loads
the plugin. Do not re-add `@oxlint/plugins`; knip reports the direct package as unused, and a copy ahead
of the loading binary is unverified. Move the toolchain with `vp migrate`.

## Known limitations

- `no-module-mocking` matches `vi`/`jest` imported from `vitest` or `@jest/globals`. This repository
  imports `vi` from `vite-plus/test`, so the rule reports nothing here — a scope limit of the rule, not a
  suppression. It starts firing if the test import source changes.
- `no-array-filter-map` does not infer unknown receiver types, so it catches only statically recognizable
  array pipelines.
- `no-reduce-accumulator-copy` covers recognized copies (`Object.assign`, `Array.from`, accumulator
  `concat`/`slice`); named callbacks and indirect helpers are not analyzed.
- `require-readable-spacing` is autofixable. Apply `vp lint --fix`, then Oxfmt, then confirm a second pass
  leaves files unchanged before keeping the result. Its fixes are whitespace-only: keep them out of
  semantic commits.

## Verification of the 2026-10-15 update (oxlint 1.88.0 via vite-plus 1.2.0)

- Upstream tests: all 24 `src/**/*.test.ts` files from `13909c9` run with Node against **this** vendored
  copy (imports pointed here, `RuleTester` from `vite-plus/lint/plugins-dev`) — 24/24 pass, including
  `require-readable-spacing-cli.test.ts`, which loads `index.ts` through the oxlint binary and checks
  `--fix` stability.
- `pnpm exec vp check` → 0 errors (8 pre-existing `react(purity)` warnings, unrelated).

## Pending decision: Effect plugin

`effect` is now a direct dependency (`4.0.4`), the condition the install used to keep `anti-slop-effect`
off. A probe over the repo reports 19 errors: 15 `no-manual-tagged-construction` (all in `tests/`),
3 `prefer-effect-match` (`hooks/useResumeStatus.ts`, `app/api/health/route.ts`, `lib/seo/sitemap.ts`)
and 1 `no-manual-tag-comparison` (`lib/ai/ai-parser.ts`). AGENTS.md confines Effect to `lib/ai/` and the
parse step, so enabling it globally would push Effect `Match` into code that must stay plain async/await.
It stays unregistered until a scoped override (`lib/ai/**`, `lib/parse/**`) or a global opt-in is chosen.

## Verification of the original install (2026-09-21, oxlint 1.81.0)

- Reachability: `tools/oxlint/anti-slop/**` is lint-ignored, so the directory being present proves nothing.
  A throwaway probe file was linted instead; every listed rule, including `oxc/no-accumulating-spread`,
  reported on representative violations, and the probe was deleted afterwards.
- `pnpm exec vp check` → format pass (481 files), lint + type-aware checks pass: **0 errors, 0 warnings
  in 429 files**. The install run reported 3896 errors in 429 files; `vp lint --fix` cleared the
  autofixable share (`require-readable-spacing` and part of `no-chained-type-assertions`), leaving 1571
  errors + 18 warnings, all of which this branch resolves. Every remaining fix was semantic, so there is
  no whitespace-only commit riding along (the one big spacing pass is the standalone commit before it).
- `pnpm run type-check` → 0. `pnpm exec knip` → 0. `pnpm run test` → 1410 passed / 98 files.
  `pnpm run build` → success.
- Post-run hash comparison confirms the cleanup left every vendored file byte-identical.
