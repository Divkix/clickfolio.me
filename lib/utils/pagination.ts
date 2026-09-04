export function safePageParam(value: string | null | undefined, fallback = 1): number {
  const n = Number.parseInt(value ?? String(fallback), 10);
  return Number.isNaN(n) || n < 1 ? fallback : Math.floor(n);
}
