/**
 * Custom spans on Cloudflare's automatic Workers traces
 * (https://developers.cloudflare.com/workers/observability/traces/custom-spans/).
 * Spans nest by async context, and `console` lines written inside one are
 * attributed to it, so logs and spans share a trace in HyperDX.
 *
 * Attributes: enums, counts and opaque DB ids only, never PII, SQL values or
 * message text. The runtime doesn't expose trace or span ids yet
 * (`spanContext()` is "planned"), so nothing can be propagated by hand.
 */
import * as workers from "cloudflare:workers";
import { errorFields } from "../utils/error-fields";

export type SpanAttributes = Parameters<Span["setAttributes"]>[0];

/** Adds attributes to the span once their values are known, e.g. token counts. */
export type Annotate = (attributes: SpanAttributes) => void;

export type ManualSpan = { end: (cause?: unknown) => void };

// Absent where `cloudflare:workers` is stubbed (client bundles, tests): spans
// are skipped and the wrapped work still runs.
const tracing = "tracing" in workers ? workers.tracing : undefined;

function recordError(span: Span, cause: unknown): void {
  // Unsampled: skip scrubbing an error nobody will see.
  if (!span.isTraced) return;
  const fields = errorFields(cause);

  span.recordException({
    name: fields["error.name"],
    message: fields["error.message"],
    code: fields["error.code"],
    stack: fields.stack,
  });
}

/** Runs `run` in a child span of the active one; a throw is recorded (scrubbed) and rethrown. */
export function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  run: (annotate: Annotate) => Promise<T>,
): Promise<T> {
  if (!tracing) return run(() => {});

  return tracing.enterSpan(name, async (span) => {
    span.setAttributes(attributes);

    try {
      return await run((more) => span.setAttributes(more));
    } catch (cause) {
      recordError(span, cause);
      throw cause;
    }
  });
}

/** A leaf span for callback-style work; it never becomes a parent. */
export function startSpan(name: string, attributes: SpanAttributes): ManualSpan {
  const span = tracing?.startSpan(name).setAttributes(attributes);

  return {
    end(cause) {
      if (!span) return;

      if (cause) recordError(span, cause);
      span.end();
    },
  };
}
