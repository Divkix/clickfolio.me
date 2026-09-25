/**
 * Landing-page A/B test (ADR-0027). `proxy.ts` assigns each visitor of `/` a
 * sticky variant via cookie; `claim_handle` is served by rewriting to
 * `CLAIM_HANDLE_PATH` so both variants stay ISR-cacheable routes.
 */

export const LANDING_VARIANTS = ["drop_first", "claim_handle"] as const;

export type LandingVariant = (typeof LANDING_VARIANTS)[number];

export const LANDING_VARIANT_COOKIE = "landing_variant";

/** Query param that forces (and re-stamps) a variant — QA / sharing a specific arm. */
export const LANDING_VARIANT_OVERRIDE_PARAM = "landing_variant";

export const LANDING_VARIANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export const CLAIM_HANDLE_PATH = "/lp/claim-handle";

/** Share of new visitors bucketed into `claim_handle`; the rest get `drop_first`. */
export const CLAIM_HANDLE_SHARE = 0.5;

export function parseLandingVariant(value: string | null | undefined): LandingVariant | null {
  return LANDING_VARIANTS.find((variant) => variant === value) ?? null;
}

/** `roll` is a uniform number in [0, 1) — injected so assignment stays pure. */
export function assignLandingVariant(roll: number): LandingVariant {
  return roll < CLAIM_HANDLE_SHARE ? "claim_handle" : "drop_first";
}

export interface LandingDecision {
  variant: LandingVariant;
  /** True when the cookie must be (re)written. */
  stamp: boolean;
}

export function decideLandingVariant(input: {
  override: string | null;
  cookie: string | null | undefined;
  roll: number;
}): LandingDecision {
  const override = parseLandingVariant(input.override);

  if (override) return { variant: override, stamp: override !== input.cookie };

  const existing = parseLandingVariant(input.cookie);

  if (existing) return { variant: existing, stamp: false };

  return { variant: assignLandingVariant(input.roll), stamp: true };
}
