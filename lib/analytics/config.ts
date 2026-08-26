/**
 * PostHog public project config.
 *
 * The project API key is public-by-design (same value the browser receives),
 * so it lives here as a literal — vinext inlines it into the client bundle
 * without depending on CF Workers Builds injecting NEXT_PUBLIC_* into the
 * Vite process.env.
 *
 * Ingestion goes through the managed PostHog reverse proxy on our own domain,
 * so the browser never talks to posthog.com directly and ad blockers that
 * only match posthog.com hostnames don't drop events.
 */

/** Public project token for the existing Clickfolio PostHog project. */
export const POSTHOG_PROJECT_TOKEN = "phc_Aw9T2GkpbXZbGYX4P3rENkvvzhbpKMgL3bFaWrepoPkV";

/** Managed US proxy host used for ingestion (browser + server). */
export const POSTHOG_API_HOST = "https://s.clickfolio.me";

/** US PostHog UI host (session replay, dashboards, toolbar). */
export const POSTHOG_UI_HOST = "https://us.posthog.com";
