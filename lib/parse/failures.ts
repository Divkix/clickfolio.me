import { Data } from "effect";
import { ParseErrorType } from "./error-types";

export type ParseErrorJson = {
  name: string;
  type: ParseErrorType;
  message: string;
  isRetryable: boolean;
  originalError: unknown;
};

type FailureDetails = { readonly message: string; readonly cause?: unknown };

const GENERIC_MESSAGE = "Something went wrong while parsing your resume. Please try again.";

export class DbUnavailable extends Data.TaggedError("DbUnavailable")<FailureDetails> {
  readonly wireType = ParseErrorType.DB_CONNECTION_ERROR;
  readonly retryable = true;
  readonly userMessage = GENERIC_MESSAGE;
}

export class AiProviderFailed extends Data.TaggedError("AiProviderFailed")<FailureDetails> {
  readonly wireType = ParseErrorType.AI_PROVIDER_ERROR;
  readonly retryable = true;
  readonly userMessage = GENERIC_MESSAGE;
}

export class AiProviderRejected extends Data.TaggedError("AiProviderRejected")<FailureDetails> {
  readonly wireType = ParseErrorType.AI_PROVIDER_ERROR;
  readonly retryable = false;
  readonly userMessage = GENERIC_MESSAGE;
}

export class AiTimedOut extends Data.TaggedError("AiTimedOut")<FailureDetails> {
  readonly wireType = ParseErrorType.SERVICE_BINDING_TIMEOUT;
  readonly retryable = true;
  readonly userMessage = "Processing timed out. Please try again.";
}

export class R2Throttled extends Data.TaggedError("R2Throttled")<FailureDetails> {
  readonly wireType = ParseErrorType.R2_THROTTLE;
  readonly retryable = true;
  readonly userMessage = GENERIC_MESSAGE;
}

type PdfInvalidReason = "encrypted" | "corrupt" | "scanned-empty" | "empty" | "too-many-pages";

const PDF_MESSAGES: Record<PdfInvalidReason, string> = {
  encrypted: "Your PDF is password-protected. Please upload an unprotected version.",
  corrupt: "Your PDF couldn't be read. Please upload a valid PDF file.",
  "scanned-empty":
    "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.",
  empty: "No text could be extracted from your PDF. It may be a scanned image.",
  "too-many-pages": "Your PDF is too long. Please upload a resume under 50 pages.",
};

export class PdfInvalid extends Data.TaggedError("PdfInvalid")<
  FailureDetails & { readonly reason: PdfInvalidReason; readonly pageCount?: number }
> {
  readonly wireType = ParseErrorType.INVALID_PDF;
  readonly retryable = false;

  get userMessage(): string {
    return PDF_MESSAGES[this.reason];
  }
}

export class R2ObjectMissing extends Data.TaggedError("R2ObjectMissing")<FailureDetails> {
  readonly wireType = ParseErrorType.FILE_NOT_FOUND;
  readonly retryable = false;
  readonly userMessage = GENERIC_MESSAGE;
}

export class R2BindingMissing extends Data.TaggedError("R2BindingMissing")<FailureDetails> {
  readonly wireType = ParseErrorType.SERVICE_BINDING_NOT_FOUND;
  readonly retryable = false;
  readonly userMessage = GENERIC_MESSAGE;
}

export class AiOutputInvalid extends Data.TaggedError("AiOutputInvalid")<FailureDetails> {
  readonly wireType = ParseErrorType.MALFORMED_RESPONSE;
  readonly retryable = false;
  readonly userMessage = GENERIC_MESSAGE;
}

export class SchemaRejected extends Data.TaggedError("SchemaRejected")<
  FailureDetails & { readonly previousOutput?: string; readonly errors?: string }
> {
  readonly wireType = ParseErrorType.PARSE_VALIDATION_ERROR;
  readonly retryable = false;
  readonly userMessage = "We couldn't parse your resume format. Please try again.";
}

// Unknown errors retain the existing permanent Workflow behavior and `unknown` wire type.
export class UnknownParseFailure extends Data.TaggedError("UnknownParseFailure")<FailureDetails> {
  readonly wireType = ParseErrorType.UNKNOWN;
  readonly retryable = false;
  readonly userMessage = GENERIC_MESSAGE;
}

export type ParseFailure =
  | DbUnavailable
  | AiProviderFailed
  | AiProviderRejected
  | AiTimedOut
  | R2Throttled
  | PdfInvalid
  | R2ObjectMissing
  | R2BindingMissing
  | AiOutputInvalid
  | SchemaRejected
  | UnknownParseFailure;

export function isParseFailure(cause: unknown): cause is ParseFailure {
  return (
    cause instanceof DbUnavailable ||
    cause instanceof AiProviderFailed ||
    cause instanceof AiProviderRejected ||
    cause instanceof AiTimedOut ||
    cause instanceof R2Throttled ||
    cause instanceof PdfInvalid ||
    cause instanceof R2ObjectMissing ||
    cause instanceof R2BindingMissing ||
    cause instanceof AiOutputInvalid ||
    cause instanceof SchemaRejected ||
    cause instanceof UnknownParseFailure
  );
}

export function toParseErrorJson(failure: ParseFailure): ParseErrorJson {
  return {
    name: "ParseError",
    type: failure.wireType,
    message: failure.message,
    isRetryable: failure.retryable,
    originalError:
      failure.cause instanceof Error
        ? { name: failure.cause.name, message: failure.cause.message }
        : failure.cause,
  };
}
