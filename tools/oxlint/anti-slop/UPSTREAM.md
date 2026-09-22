# Vendored anti-slop Oxlint plugin

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit
`e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a` (2026-09-10, "feat(effect): prefer Match for literal branches").
Copied from the skill bundle for `skills/install-anti-slop` (`~/.agents/skills/install-anti-slop`), whose
folder hash at that revision is `89044d21c75a367eac1ddbaf208e650b1a7d5820` — the same hash recorded for
`install-anti-slop` in `~/.agents/.skill-lock.json`.

Identity was verified, not inferred: all 38 files copied from
`skills/install-anti-slop/assets/anti-slop/` were compared byte-for-byte against the upstream blobs at
that revision (`git hash-object` against the GitHub tree API) — 0 missing, 0 extra, 0 mismatches. The
vendored tree is therefore a pristine copy of an identified revision, so a future update can replace it
rather than reconstruct a merge base. The only local addition is this file; no upstream file has been
edited. The upstream tracked revision is not the newest commit on the default branch — re-resolve before
the next update.

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

`@oxlint/plugins` is pinned exactly to `1.81.0`. This repository has no direct `oxlint` dependency —
`vite-plus` 0.3.1 (catalog) hard-pins `oxlint =1.81.0` and provides the binary that loads the plugin — so
the runtime import is pinned to the evaluator's version rather than to the newest release. A
`@oxlint/plugins` ahead of the loading binary is unverified. Bump both together when the toolchain moves
(`vp migrate`, then match the new `oxlint` pin).

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

## Verification of this install (2026-09-21, oxlint 1.81.0)

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
