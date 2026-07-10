/**
 * PostHog public project config.
 *
 * The project API key is public-by-design (same value the browser receives).
 * Defaults match wrangler.jsonc `vars` so client inlining still works when
 * CF Workers Builds does not inject NEXT_PUBLIC_* into the Vite process.env
 * (vinext then emits `{}.NEXT_PUBLIC_…` which is undefined without a fallback).
 *
 * Override via env for staging/local if needed.
 */
export const POSTHOG_PROJECT_TOKEN =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
  "phc_Aw9T2GkpbXZbGYX4P3rENkvvzhbpKMgL3bFaWrepoPkV";

export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

export const POSTHOG_UI_HOST = "https://us.posthog.com";
