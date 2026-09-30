# One Studio landing page and app-wide theme

Status: accepted.

## Context

The landing-page A/B test in ADR-0027 ended on 2026-09-30 with no statistically significant winner. PostHog results for all time since 2026-07-10 were:

- **Uploads:** 36% for `drop_first` versus 22% for `claim_handle` (Fisher's exact test, p=0.29).
- **Completed onboarding:** 12% versus 11% (Fisher's exact test, p=1.0).
- **Handle engagement:** 37% of `claim_handle` viewers engaged with the handle input.

The upload-first flow remains useful, and visitors also engage with choosing an address. Rather than retain two variants, we can combine those interactions in the Studio design and give the app a more premium, trustworthy look.

## Decision

- **Landing:** serve one `HomeLanding` ("Studio") at `/`, combining a minimal hero upload CTA with the live design viewer whose address bar is the handle input. `app/page.tsx` renders `HomeJsonLd` and `HomeLanding`.
- **Routing:** retire the proxy cookie split and the alternate landing routes. `proxy.ts` retains only the protected-route `__session` presence check.
- **Theme:** adopt Studio's white and ultramarine `#2a3fd1` palette app-wide, with dark ink `#0e0f14` and accent `#7c8cff`. Use "Onest Variable" for app typography. Shared tokens live in `app/globals.css` and are consumed through semantic Tailwind classes.

## Consequences

- `landing_viewed` and `landing_variant` are no longer sent. `landing_cta_clicked { location }` and `landing_handle_checked { status }` remain, without variant properties.
- The dropzone leaves the hero. Watch upload conversion against the `drop_first` baseline rather than treating the inconclusive test as evidence of an improvement.
- Desired-handle carry-over now lives in `lib/utils/desired-handle.ts`; the saved handle still prefills the wizard and is cleared after confirmation.
