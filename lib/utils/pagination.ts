export function parsePageParam(value: string | string[] | null | undefined): number | null {
  if (value == null) return 1;

  if (Array.isArray(value) || !/^[1-9]\d*$/.test(value)) return null;

  const page = Number(value);

  return Number.isSafeInteger(page) ? page : null;
}

export function safePageParam(value: string | null | undefined, fallback = 1): number {
  return parsePageParam(value) ?? fallback;
}
