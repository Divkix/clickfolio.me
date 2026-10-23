// zod/mini, not zod: client error boundaries import this, and full zod doesn't tree-shake.
import * as z from "zod/mini";

// A type alias, not an interface, so it stays assignable to `UnknownRecord`.
export type ErrorFields = {
  "error.message": string;
  "error.name": string;
  "error.code"?: string;
  stack?: string;
};

const EMAIL_PATTERN = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[^\s@"'<>()]+/g;

// Drizzle's DrizzleQueryError: `Failed query: <sql>\nparams: <values>`.
const QUERY_ERROR_PREFIX = "Failed query: ";

const PARAMS_MARKER = "\nparams: ";

const MAX_MESSAGE_LENGTH = 2000;

const MAX_CAUSE_DEPTH = 5;

// Libraries and the Workflow engine can throw Error-shaped values that aren't `Error` instances.
const errorLikeSchema = z.object({
  name: z.catch(z.optional(z.string()), undefined),
  message: z.string(),
  stack: z.catch(z.optional(z.string()), undefined),
  // Postgres SQLSTATE; numeric codes from other libraries are dropped.
  code: z.catch(z.optional(z.string()), undefined),
});

/**
 * Drops bound SQL params (also when a wrapper copied Drizzle's message or the
 * Workflow engine serialized it), redacts emails a provider or driver echoed
 * back, and caps the length.
 */
function scrub(text: string): string {
  const paramsAt = text.indexOf(PARAMS_MARKER);
  const withoutParams = paramsAt === -1 ? text : `${text.slice(0, paramsAt)} [params redacted]`;

  return withoutParams.replace(EMAIL_PATTERN, "[email]").slice(0, MAX_MESSAGE_LENGTH);
}

function nonErrorMessage(cause: unknown): string {
  const text = z.string().safeParse(cause);

  if (text.success) return text.data;

  try {
    return JSON.stringify(cause) ?? String(cause);
  } catch {
    return String(cause);
  }
}

/**
 * The driver error under Drizzle's wrapper, anywhere in the cause chain. Wrappers
 * that copied the wrapper's message (`classifyParseError`) are skipped too.
 */
function driverError(cause: Error): Error | null {
  let current: Error = cause;
  let belowQuery = false;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    const isQueryMessage = current.message.startsWith(QUERY_ERROR_PREFIX);

    if (belowQuery && !isQueryMessage) return current;
    belowQuery ||= isQueryMessage;

    if (!(current.cause instanceof Error)) return null;
    current = current.cause;
  }

  return null;
}

/**
 * V8 frames only. The raw header is cut first: a multi-line message (Drizzle's
 * params can hold resume text) could otherwise contribute lines like "at Acme".
 */
function stackFrames(stack: string | undefined, header: string): string[] {
  if (!stack) return [];
  const body = stack.startsWith(header) ? stack.slice(header.length) : stack;

  return body.split("\n").filter((line) => /^\s+at /.test(line));
}

/**
 * Log fields for a caught value, tolerating non-Error throws. A Drizzle query
 * failure is reported by the driver's message and SQLSTATE, and the stack
 * header is rebuilt from the scrubbed message, so bound SQL params never reach
 * telemetry.
 */
export function errorFields(cause: unknown): ErrorFields {
  const outer = errorLikeSchema.safeParse(cause);

  if (!outer.success)
    return { "error.message": scrub(nonErrorMessage(cause)), "error.name": "NonError" };

  const driver = cause instanceof Error ? errorLikeSchema.safeParse(driverError(cause)) : null;
  const source = driver?.success ? driver.data : outer.data;
  const name = outer.data.name ?? "Error";
  const message = scrub(source.message);
  const fields: ErrorFields = { "error.message": message, "error.name": name };

  if (source.code) fields["error.code"] = source.code;
  const frames = stackFrames(outer.data.stack, `${name}: ${outer.data.message}`);

  if (frames.length) fields.stack = [`${name}: ${message}`, ...frames].join("\n");

  return fields;
}
