# Stubs for CF-incompatible packages

`@vercel/og`, `@zxcvbn-ts/*`, `zod/v3`, `async_hooks`, and `cloudflare:workers` are stubbed (see `lib/stubs/`). These don't run on Workers or cause dual-bundle issues; stubs keep the bundle valid and small. The `zod/v3` stub drops a dead 128 KB AI-SDK path; the `@vercel/og` stub drops ~2 MB resvg+yoga (the live OG PNG path uses `@cf-wasm/resvg` instead).
