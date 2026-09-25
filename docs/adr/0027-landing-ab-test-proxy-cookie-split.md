# Landing-page A/B test via a `proxy.ts` cookie split + PostHog funnel

Status: accepted.

## Context

We want to compare two landing pages: `drop_first`, with the upload card in the hero, and `claim_handle`, which leads with typing your `@handle`. The winner is chosen on sign-ups that finish onboarding, not on clicks. Both pages must stay ISR-cached, keep the `/` URL and SEO metadata, and add no paid tooling.

We considered and rejected these options:

- **PostHog feature-flag experiments.** Deciding the variant on the client causes flicker. Deciding it on the server means reading `/flags` on every request, which breaks ISR.
- **Cloudflare Flagship.** It is in beta and needs a flag evaluation per request, where a plain random split is enough.
- **`?variant=` / `searchParams` on `/`.** This makes the route dynamic and loses ISR.

## Decision

- **Bucketing:** `proxy.ts` runs `decideLandingVariant` (`lib/experiments/landing.ts`) only for `pathname === "/"`.
  - A valid `landing_variant` cookie is sticky: it lasts 90 days and is not re-written.
  - A missing or unknown cookie is assigned with `Math.random() < CLAIM_HANDLE_SHARE` (0.5), and the cookie is stamped.
  - `?landing_variant=<variant>` forces and re-stamps an arm, for QA.
- **Serving:** `drop_first` is `app/page.tsx`. `claim_handle` is `app/lp/claim-handle/page.tsx`, served through `NextResponse.rewrite`, so the browser URL stays `/` and the query is kept.
  - Both routes use `revalidate 3600`, the shared `HOME_METADATA` (canonical `/`) and `HomeJsonLd`.
- **Measurement:** PostHog only. Umami stays pageviews-only.
  - `LandingExperimentTracker` registers the `landing_variant` super property, so every later event carries it. It also sets the person property with set-once semantics and sends `landing_viewed`.
  - The CTAs send `landing_cta_clicked`, and the handle input sends `landing_handle_checked`.
  - Funnel: `landing_viewed → resume_uploaded → resume_claimed → onboarding_completed`, broken down by `landing_variant`.
- **Handle carry-over:** the handle typed on `claim_handle` is saved to localStorage (`lib/experiments/desired-handle.ts`) and prefills the wizard's handle step. It is cleared once the user confirms a handle.

## Consequences

- `/lp/claim-handle` can also be reached directly. It is not linked anywhere, has canonical `/` and is not in the sitemap.
- Crawlers without cookies get a random arm on each request. Both arms share the same metadata and H1 keyword prefix.
- To end the test: move the winning component into `app/page.tsx`, then delete the `proxy.ts` branch, `app/lp/`, the losing component and `lib/experiments/landing.ts`. Keep the events if they are still useful.
