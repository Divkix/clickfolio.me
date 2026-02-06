/**
 * Queue error classification system
 * Categorizes errors as transient (retryable) or permanent (should not retry)
 */

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
  readonly originalError?: unknown;

  constructor(type: QueueErrorType, message: string, originalError?: unknown) {
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
  toJSON(): Record<string, unknown> {
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

/**
 * Error message patterns for classification
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; type: QueueErrorType }> = [
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
    pattern: /file.*not.*found|object.*not.*found|key.*not.*found|404/i,
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
 * @param error - The error to classify (can be Error, string, or unknown)
 * @returns A QueueError with the appropriate type
 */
export function classifyQueueError(error: unknown): QueueError {
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
 * Extracts a string message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Include cause if available
    const cause = error.cause ? ` (cause: ${extractErrorMessage(error.cause)})` : "";
    return `${error.message}${cause}`;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    // Handle response-like objects
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
    // Handle status code objects
    if ("status" in error && typeof error.status === "number") {
      return `HTTP ${error.status}`;
    }
  }

  return "Unknown error";
}

/**
 * Type guard to check if an error is a QueueError
 */
function isQueueError(error: unknown): error is QueueError {
  return error instanceof QueueError;
}

/**
 * Utility to quickly check if an error is retryable without creating a QueueError
 */
export function isRetryableError(error: unknown): boolean {
  if (isQueueError(error)) {
    return error.isRetryable();
  }
  return classifyQueueError(error).isRetryable();
}
