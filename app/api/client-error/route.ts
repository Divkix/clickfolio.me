/**
 * POST /api/client-error
 *
 * Receives client-side error reports from error boundaries.
 * Logs with [client-error] prefix. Always returns 204 — must never leak info or break recovery.
 */

const EMPTY_204 = new Response(null, { status: 204 });

interface ClientErrorBody {
  message?: unknown;
  stack?: unknown;
  componentStack?: unknown;
  url?: unknown;
}

function truncate(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function POST(request: Request) {
  try {
    let body: ClientErrorBody;
    try {
      body = (await request.json()) as ClientErrorBody;
    } catch {
      return EMPTY_204;
    }

    const message = truncate(body.message, 1000);
    if (!message) return EMPTY_204;

    const stack = truncate(body.stack, 2000);
    const componentStack = truncate(body.componentStack, 2000);
    const url = truncate(body.url, 500);

    console.error(`[client-error] ${message}`, JSON.stringify({ url, stack, componentStack }));

    return EMPTY_204;
  } catch {
    return EMPTY_204;
  }
}
