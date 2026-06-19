/**
 * Date-axis helpers for analytics charts.
 */

/**
 * Returns the last `days` UTC calendar days as YYYY-MM-DD strings, oldest first
 * and ending today (UTC). Used to build a gap-free date axis for analytics
 * responses (callers map each date to their own row shape).
 *
 * Anchored on Date.now() so it tracks the current wall clock per request.
 *
 * @param days - Number of trailing days to produce
 * @returns Array of YYYY-MM-DD strings, oldest first, length === days
 */
export function lastNUtcDays(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    result.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return result;
}
