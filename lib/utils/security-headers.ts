export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  // 'unsafe-inline': the SSR hydration scripts are inline and the Worker issues no nonces.
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://analytics.divkix.me https://clerk.clickfolio.me https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://analytics.divkix.me https://accounts.google.com https://clerk.clickfolio.me https://*.clerk.accounts.dev https://*.protect.clerk.com:*; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.protect.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
} as const;

export function createErrorResponse<T>(
  error: string,
  code: string,
  status: number,
  details?: T,
  retryAfterSeconds?: number,
): Response {
  const headers = new Headers({ "Content-Type": "application/json", ...SECURITY_HEADERS });

  if (retryAfterSeconds !== undefined) headers.set("Retry-After", String(retryAfterSeconds));

  return new Response(JSON.stringify({ error, code, details }), { status, headers });
}

export function createSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SECURITY_HEADERS,
    },
  });
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;
