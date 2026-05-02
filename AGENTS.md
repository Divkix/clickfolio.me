# AGENTS.md — clickfolio.me

## Stack

- **Runtime**: Cloudflare Workers (no `fs`, no Next.js `<Image/>`, no D1 in middleware)
- **Framework**: [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js) — NOT standard Next.js
- **Package manager**: `bun`
- **DB**: Cloudflare D1 + Drizzle ORM (SQLite)
- **Auth**: Better Auth (Google OAuth only)
- **Storage**: Cloudflare R2 (binding `CLICKFOLIO_R2_BUCKET`)
- **Styling**: shadcn/ui (new-york style) + Tailwind CSS 4
- **Validation**: Zod
- **Lint/format**: Biome (not ESLint/Prettier)
- **Testing**: Vitest + jsdom + @testing-library/react

## Essential commands

```bash
bun run dev              # Vite dev server on :3000
bun run type-check       # tsc --noEmit
bun run lint             # biome check .
bun run fix              # biome --write .
bun run test             # all tests
bun run test:unit        # unit only (fast, no retries)
bun run test:integration # integration only
bun run test:security    # security only
bun run test:coverage    # all tests + coverage
bun run build            # vite build (vinext)
bun run preview          # local CF Workers preview (build + wrangler dev)
bun run ci               # frozen lockfile install + type-check + lint + test + build
bun run deploy           # build + deploy to CF Workers
bun run db:generate      # drizzle-kit generate
bun run db:migrate       # apply migrations to local D1
bun run db:migrate:prod  # apply to production D1
bun run cf-typegen       # regen lib/cloudflare-env.d.ts
```

## Pre-push checklist

```
bun run type-check && bun run lint && bun run test
```

CI runs these in parallel, plus `knip` (unused exports) and `build`. `quality` job runs Biome without installing deps.

## Architecture

### Custom worker wrapper (`worker/index.ts`)
The real entrypoint. Wraps vinext's handler and adds:
- Queue consumer (`CLICKFOLIO_PARSE_QUEUE`) + DLQ handler
- 4 cron triggers (R2 cleanup, DB cleanup, disposable domain sync, orphan recovery)
- WebSocket upgrade routing (`/ws/resume-status`) → Durable Object

### Route structure
- `app/(public)/` — no auth required (home, [handle] viewer)
- `app/(protected)/` — auth-gated (dashboard, edit, settings, waiting)
- `app/api/` — API routes
- `proxy.ts` — vinext proxy (cookie-only auth check, NO D1 access)
- Old URL shape `/handle` → 308 redirect to `/@handle` (exclusion list in `next.config.ts`)

### DB bindings
| Binding | Type | Name |
|---|---|---|
| `CLICKFOLIO_DB` | D1 | `clickfolio-db` |
| `CLICKFOLIO_R2_BUCKET` | R2 | `clickfolio-bucket` |
| `CLICKFOLIO_DISPOSABLE_DOMAINS` | KV | — |
| `CLICKFOLIO_PARSE_QUEUE` | Queue | `clickfolio-parse-queue` |
| `CLICKFOLIO_STATUS_DO` | DO | `ClickfolioStatusDO` |

`getDb(env.CLICKFOLIO_DB)` — use this function, not raw drizzle. It caches per-isolate via WeakMap.

### Env variables
- `BETTER_AUTH_URL` = single source of truth for app URL
- Local dev: secrets in `.dev.vars` (auto-loaded by Vite)
- Production: `wrangler secret put ...`
- AI gateway (OpenRouter via CF AI Gateway): `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_ID`, `CF_AIG_AUTH_TOKEN`

### Stubs
- `cloudflare:workers` → stubbed for client/vitest (`lib/stubs/cloudflare-workers-client-stub.mjs`)
- `@vercel/og` → stubbed (doesn't work on CF Workers)
- `@zxcvbn-ts/*` → stubbed in SSR (password strength runs client-side only)

### Module aliases
`@/*` → project root. Defined in both `tsconfig.json` and `vite.config.ts`.

## Code conventions

- Double quotes, semicolons, trailing commas, 2-space indent, 100-char line width (Biome enforced)
- `getDb()` for D1 access — never construct drizzle directly
- Zod schemas in `lib/schemas/`
- shadcn components in `components/ui/`, resume templates in `components/templates/`
- `lib/cloudflare-env.d.ts` is auto-generated, excluded from Biome lint/format
- Rate limits: 5 uploads/day per user (authenticated), 10/hour & 50/day per IP (anonymous); 3 handle changes/24hr per user

## Testing

- `__tests__/unit/`, `__tests__/integration/`, `__tests__/security/` (trophy model)
- Test files: `*.test.ts` or `*.test.tsx`
- Setup: `__tests__/setup.ts` (jsdom, jest-dom matchers)
- Coverage thresholds enforced in CI (30% lines/statements, 25% functions)

## Known platform constraints

- No `fs` module — use R2 bindings for file I/O
- No D1 access in proxy/middleware — auth check is cookie-only there
- `unsafe-inline` in CSP required for React hydration on Workers (no nonce support)
- Build requires `dist/client/` directory to exist before `writeBundle` (handled by `ensureClientDir` plugin)
- `vinext` uses `@cloudflare/vite-plugin` — don't add raw wrangler CLI to the build pipeline
