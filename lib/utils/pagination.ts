/**
 * Parse a pagination `page` parameter into a safe 1-based integer.
 *
 * `Math.max(1, Number.parseInt(...))` is NOT safe: a non-numeric value parses to
 * `NaN`, and `Math.max(1, NaN) === NaN`, which then leaks into SQL OFFSETs and
 * pagination link hrefs (`NaN.toString() === "NaN"`). This guards both the
 * non-numeric case and the sub-1 case, returning the {@link fallback} instead.
 *
 * @param value - Raw `page` param from search params / route params.
 * @param fallback - Page to use when the value is missing, non-numeric, or < 1.
 */
export function safePageParam(value: string | null | undefined, fallback = 1): number {
  const n = Number.parseInt(value ?? String(fallback), 10);
  return Number.isNaN(n) || n < 1 ? fallback : Math.floor(n);
}
