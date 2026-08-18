/**
 * Queue error classification system
 * Categorizes errors as transient (retryable) or permanent (should not retry)
 */
import { z } from "zod";
import type { JsonValue } from "@/lib/types/json";

export type QueueErrorInput =
  | Error
  | QueueError
  | string
  | { message?: string; error?: string; status?: number; cause?: JsonValue }
  | null
  | undefined;

/**
 * Error types for queue processing
 */
export enum QueueErrorType {
  // Transient errors (should retry)
  DB_CONNECTION_ERROR = "db_connection_error",
  SERVICE_BINDING_TIMEOUT = "service_binding_timeout",
  R2_THROTTLE = "r2_throttle",
  AI_PROVIDER_ERROR = "ai_provider_error",

  // Permanent errors (should ack, no retry)
  INVALID_PDF = "invalid_pdf",
  MALFORMED_RESPONSE = "malformed_response",
  SERVICE_BINDING_NOT_FOUND = "service_binding_not_found",
  FILE_NOT_FOUND = "file_not_found",
  PARSE_VALIDATION_ERROR = "parse_validation_error",
  UNKNOWN = "unknown",
}

/**
 * Set of transient error types that should be retried
 */
const TRANSIENT_ERROR_TYPES = new Set<QueueErrorType>([
  QueueErrorType.DB_CONNECTION_ERROR,
  QueueErrorType.SERVICE_BINDING_TIMEOUT,
  QueueErrorType.R2_THROTTLE,
  QueueErrorType.AI_PROVIDER_ERROR,
]);

/**
 * Custom error class for queue processing
 */
export class QueueError extends Error {
  readonly type: QueueErrorType;
  readonly originalError?: QueueErrorInput;

  constructor(type: QueueErrorType, message: string, originalError?: QueueErrorInput) {
    super(message);
    this.name = "QueueError";
    this.type = type;
    this.originalError = originalError;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueueError);
    }
  }

  /**
   * Determines if this error is retryable
   * Returns true for transient errors that may succeed on retry
   */
  isRetryable(): boolean {
    return TRANSIENT_ERROR_TYPES.has(this.type);
  }

  /**
   * Create a JSON-serializable representation
   */
  toJSON(): QueueErrorJson {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      isRetryable: this.isRetryable(),
      originalError:
        this.originalError instanceof Error
          ? {
              name: this.originalError.name,
              message: this.originalError.message,
            }
          : this.originalError,
    };
  }
}

export type QueueErrorJson = {
  name: string;
  type: QueueErrorType;
  message: string;
  isRetryable: boolean;
  originalError: unknown;
};

/**
 * Regex patterns for classifying error messages into QueueErrorTypes.
 * Each pattern maps a case-insensitive regex to a transient or permanent error type.
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; type: QueueErrorType }> = [
  // DB constraint violations (FK/UNIQUE) are permanent — retrying can never fix
  // them. This MUST stay ahead of the D1_ERROR pattern: "D1_ERROR: FOREIGN KEY
  // constraint failed" would otherwise classify as a retryable connection error
  // and burn 3 retries before reaching the DLQ.
  {
    pattern: /constraint.*failed|constraint.*violation/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },

  // D1/Database connection errors (transient)
  {
    pattern: /D1_ERROR|database.*connection|connection.*refused|SQLITE_BUSY|database.*locked/i,
    type: QueueErrorType.DB_CONNECTION_ERROR,
  },
  {
    pattern: /database.*unavailable|db.*timeout|transaction.*failed/i,
    type: QueueErrorType.DB_CONNECTION_ERROR,
  },

  // Service binding timeouts (transient)
  {
    pattern: /timeout|timed?\s*out|deadline.*exceeded|worker.*timeout/i,
    type: QueueErrorType.SERVICE_BINDING_TIMEOUT,
  },
  {
    pattern: /request.*took.*too.*long|exceeded.*time.*limit/i,
    type: QueueErrorType.SERVICE_BINDING_TIMEOUT,
  },

  // R2 throttle errors (transient)
  {
    pattern: /R2.*throttle|rate.*limit|too.*many.*requests|429/i,
    type: QueueErrorType.R2_THROTTLE,
  },
  {
    pattern: /R2.*temporarily.*unavailable|R2.*service.*unavailable/i,
    type: QueueErrorType.R2_THROTTLE,
  },

  // Invalid PDF errors (permanent)
  {
    pattern: /invalid.*pdf|corrupt.*pdf|pdf.*corrupt|pdf.*invalid|malformed.*pdf/i,
    type: QueueErrorType.INVALID_PDF,
  },
  {
    pattern: /not.*a.*pdf|pdf.*extraction.*failed|cannot.*parse.*pdf/i,
    type: QueueErrorType.INVALID_PDF,
  },
  {
    pattern: /encrypted.*pdf|password.*protected|pdf.*encrypted/i,
    type: QueueErrorType.INVALID_PDF,
  },
  {
    pattern: /extracted.*resume.*text.*is.*empty/i,
    type: QueueErrorType.INVALID_PDF,
  },
  {
    pattern: /scanned.*pdf|clearer.*photo|export.*as.*text.*pdf/i,
    type: QueueErrorType.INVALID_PDF,
  },
  // Too-many-pages PDF — matches lib/ai/pdf-extract.ts:
  // "PDF has ${numPages} pages (maximum 50). Please upload a shorter document."
  // (a retry would hit the exact same 50-page cap, so it is permanent)
  {
    pattern: /pdf.*has.*\d+.*pages|too.*many.*pages/i,
    type: QueueErrorType.INVALID_PDF,
  },

  // AI provider errors (transient — provider down, model unavailable, etc.)
  {
    pattern: /NoObjectGeneratedError|no.*object.*generated/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  {
    pattern: /API.*error|api.*request.*failed|provider.*error/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  {
    pattern: /model.*not.*found|model.*unavailable|insufficient.*credits/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  {
    pattern:
      /HTTP\s*5\d{2}|status.*5\d{2}|internal.*server.*error|bad.*gateway|service.*unavailable/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  // AI SDK APICallError shapes (@ai-sdk/provider): name "AI_APICallError" and
  // messages "Cannot connect to API: ...", "Failed to process error response",
  // "Failed to process successful response" (the latter two carry statusCode).
  {
    pattern: /AI_APICallError|ai_apicall_error|cannot connect to api/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  {
    pattern: /failed to process (error|successful) response/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },

  // Malformed response errors (permanent)
  {
    pattern: /invalid.*json|json.*parse|unexpected.*token|malformed.*response/i,
    type: QueueErrorType.MALFORMED_RESPONSE,
  },
  {
    pattern: /invalid.*json.*response.*from.*ai/i,
    type: QueueErrorType.MALFORMED_RESPONSE,
  },
  {
    pattern: /ai.*parsing.*failed|parsing.*failed/i,
    type: QueueErrorType.MALFORMED_RESPONSE,
  },

  // Service binding not found (permanent)
  {
    pattern: /worker.*not.*available|binding.*not.*available|service.*not.*found/i,
    type: QueueErrorType.SERVICE_BINDING_NOT_FOUND,
  },
  {
    pattern: /pdf.*worker.*not.*available|ai.*parser.*not.*available/i,
    type: QueueErrorType.SERVICE_BINDING_NOT_FOUND,
  },
  {
    pattern: /R2.*binding.*not.*available/i,
    type: QueueErrorType.SERVICE_BINDING_NOT_FOUND,
  },

  // File not found errors (permanent)
  {
    pattern: /file.*not.*found|object.*not.*found|key.*not.*found|\b404\b/i,
    type: QueueErrorType.FILE_NOT_FOUND,
  },
  {
    pattern: /failed.*to.*fetch.*pdf.*from.*r2/i,
    type: QueueErrorType.FILE_NOT_FOUND,
  },
  {
    pattern: /r2.*object.*does.*not.*exist|no.*such.*key/i,
    type: QueueErrorType.FILE_NOT_FOUND,
  },

  // Parse validation errors (permanent)
  {
    pattern: /validation.*error|schema.*validation|zod.*error/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },
  {
    pattern: /required.*field.*missing|invalid.*field|type.*mismatch/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },
];

/**
 * Classifies an error into a QueueErrorType based on pattern matching
 * @param error - The error to classify (can be Error, string, or QueueErrorInput)
 * @returns A QueueError with the appropriate type
 */
export function classifyQueueError(error: QueueErrorInput): QueueError {
  const errorMessage = extractErrorMessage(error);

  for (const { pattern, type } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return new QueueError(type, errorMessage, error);
    }
  }

  // Default to UNKNOWN for unrecognized errors
  return new QueueError(QueueErrorType.UNKNOWN, errorMessage, error);
}

/**
 * Extract a string message from various error types.
 *
 * Strategy:
 * - `Error` instances: includes `error.message` and recursively extracts `cause`.
 * - Plain strings: returned directly.
 * - Response-like objects: checks `message`, `error`, and `status` properties.
 * - Falls back to "Unknown error" for anything else.
 */
function extractErrorMessage(error: QueueErrorInput): string {
  if (error instanceof Error) {
    // Include cause if available
    // SAFETY: error.cause is from Error instance, narrowed via instanceof Error branch; QueueErrorInput is safe union for recursion.
    const cause =
      error.cause != null ? ` (cause: ${extractErrorMessage(error.cause as QueueErrorInput)})` : "";
    return `${error.message}${cause}`;
  }

  if (z.string().safeParse(error).success) {
    // SAFETY: zod safeParse above guarantees error is string.
    return error as string;
  }

  if (error != null && error instanceof Object) {
    // Handle response-like objects
    // SAFETY: Object guard above ensures error is a non-null object; Record cast is safe for dynamic key access.
    const record = error as Record<string, JsonValue>;
    if ("message" in record && z.string().safeParse(record.message).success) {
      // SAFETY: zod safeParse above guarantees record.message is string.
      return record.message as string;
    }
    if ("error" in record && z.string().safeParse(record.error).success) {
      // SAFETY: zod safeParse above guarantees record.error is string.
      return record.error as string;
    }
    // Handle status code objects
    if ("status" in record && z.number().safeParse(record.status).success) {
      // SAFETY: zod safeParse above guarantees record.status is number.
      return `HTTP ${String(record.status as number)}`;
    }
  }

  return "Unknown error";
}

/**
 * Type guard to check if an unknown value is a QueueError instance.
 */
function isQueueError(error: QueueErrorInput): error is QueueError {
  return error instanceof QueueError;
}

/**
 * Utility to quickly check if an error is retryable without creating a QueueError
 */
export function isRetryableError(error: QueueErrorInput): boolean {
  if (isQueueError(error)) {
    return error.isRetryable();
  }
  return classifyQueueError(error).isRetryable();
}
