# 24h pending-upload cookie + client-only email rendering

## Context

Two reliability/UX issues surfaced from session recordings and PostHog:

1. **Pre-auth upload loss.** The `pending_upload` signed cookie expired after 30 minutes (Issue #89 security stance), but R2 temp files live for 24h (`TEMP_CUTOFF_HOURS = 24`). A user who uploaded anonymously and took longer than 30 min to create an account lost the ability to claim their upload, forcing a second trip through the flaky upload flow.
2. **React #418 hydration errors** on public profile pages. Cloudflare Email Address Obfuscation rewrites visible email text in SSR HTML into encoded `<span>`s that React cannot reconcile.

## Decision

- **Align the cookie TTL with R2:** `COOKIE_MAX_AGE` is now 24h (was 30 min). The cookie is HMAC-SHA256 signed and only authorizes claiming a temp object the holder already uploaded, so the longer window is low-risk. `pre_auth: true` is sent on claims that associate a pre-auth upload with a fresh account, tagged on the `resume_claimed`/`resume_claim_cached` PostHog events.
- **Keep emails out of SSR HTML:** profile templates render a user's email via `EmailLink` (full `mailto:` link) or `ObfuscatedText` (visible text only) — both client-only, with a neutral first-paint placeholder and `suppressHydrationWarning`. The `mailto:` href on `getContactLinks`-based templates remains in SSR (Cloudflare rewrites the href _attribute_, which React patches silently — that does not trigger #418).

## Consequences

- Disabling Cloudflare Scrape Shield → Email Address Obfuscation in the dashboard is still recommended as a belt-and-suspenders fix (cannot be toggled from code).
- SEO/scrape trade-off: emails are not in raw SSR HTML, so naive crawlers that don't run JS won't see them. This is the desired behavior (less scraping).
- `resume_upload_failed` PostHog event now carries `error_reason` (machine code) alongside `error_message` (kept one release for backward-compat).
