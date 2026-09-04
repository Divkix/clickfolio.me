import { z } from "zod";
import type { JsonValue } from "@/lib/types/json";

export type QueueErrorInput =
  | Error
  | QueueError
  | string
  | { message?: string; error?: string; status?: number; cause?: JsonValue }
  | null
  | undefined;

export enum QueueErrorType {
  DB_CONNECTION_ERROR = "db_connection_error",
  SERVICE_BINDING_TIMEOUT = "service_binding_timeout",
  R2_THROTTLE = "r2_throttle",
  AI_PROVIDER_ERROR = "ai_provider_error",

  INVALID_PDF = "invalid_pdf",
  MALFORMED_RESPONSE = "malformed_response",
  SERVICE_BINDING_NOT_FOUND = "service_binding_not_found",
  FILE_NOT_FOUND = "file_not_found",
  PARSE_VALIDATION_ERROR = "parse_validation_error",
  UNKNOWN = "unknown",
}

const TRANSIENT_ERROR_TYPES = new Set<QueueErrorType>([
  QueueErrorType.DB_CONNECTION_ERROR,
  QueueErrorType.SERVICE_BINDING_TIMEOUT,
  QueueErrorType.R2_THROTTLE,
  QueueErrorType.AI_PROVIDER_ERROR,
]);

export class QueueError extends Error {
  readonly type: QueueErrorType;
  readonly originalError?: QueueErrorInput;

  constructor(type: QueueErrorType, message: string, originalError?: QueueErrorInput) {
    super(message);
    this.name = "QueueError";
    this.type = type;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueueError);
    }
  }

  isRetryable(): boolean {
    return TRANSIENT_ERROR_TYPES.has(this.type);
  }

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

const ERROR_PATTERNS: Array<{ pattern: RegExp; type: QueueErrorType }> = [
  {
    pattern:
      /duplicate key value violates unique constraint|violates foreign key constraint|violates not-null constraint|violates check constraint|violates exclusion constraint/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },
  {
    pattern: /\[pg_code=(?:23000|23001|23502|23503|23505|23514)\]/,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },

  {
    pattern:
      /\[pg_code=(?:08000|08001|08003|08004|08006|53300|53400|57P01|57P02|57P03|40001|40P01|55P03)\]/,
    type: QueueErrorType.DB_CONNECTION_ERROR,
  },
  {
    pattern:
      /database.*connection|connection.*(?:refused|reset|terminated|closed|aborted|timed?\s*out)|server closed the connection|terminating connection|too many clients|too many connections|ECONNREFUSED|ECONNRESET|ECONNABORTED|EPIPE|ETIMEDOUT|ENOTFOUND|getaddrinfo|failed to connect/i,
    type: QueueErrorType.DB_CONNECTION_ERROR,
  },
  {
    pattern:
      /database.*unavailable|db.*timeout|transaction.*failed|deadlock detected|serialization failure|could not serialize|statement timeout|lock wait timeout/i,
    type: QueueErrorType.DB_CONNECTION_ERROR,
  },

  {
    pattern: /timeout|timed?\s*out|deadline.*exceeded|worker.*timeout/i,
    type: QueueErrorType.SERVICE_BINDING_TIMEOUT,
  },
  {
    pattern: /request.*took.*too.*long|exceeded.*time.*limit/i,
    type: QueueErrorType.SERVICE_BINDING_TIMEOUT,
  },

  {
    pattern: /R2.*throttle|rate.*limit|too.*many.*requests|429/i,
    type: QueueErrorType.R2_THROTTLE,
  },
  {
    pattern: /R2.*temporarily.*unavailable|R2.*service.*unavailable/i,
    type: QueueErrorType.R2_THROTTLE,
  },

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
  {
    pattern: /pdf.*has.*\d+.*pages|too.*many.*pages/i,
    type: QueueErrorType.INVALID_PDF,
  },

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
  {
    pattern: /AI_APICallError|ai_apicall_error|cannot connect to api/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },
  {
    pattern: /failed to process (error|successful) response/i,
    type: QueueErrorType.AI_PROVIDER_ERROR,
  },

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

  {
    pattern: /validation.*error|schema.*validation|zod.*error/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },
  {
    pattern: /required.*field.*missing|invalid.*field|type.*mismatch/i,
    type: QueueErrorType.PARSE_VALIDATION_ERROR,
  },
];

export function classifyQueueError(error: QueueErrorInput): QueueError {
  const errorMessage = extractErrorMessage(error);

  for (const { pattern, type } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return new QueueError(type, errorMessage, error);
    }
  }

  return new QueueError(QueueErrorType.UNKNOWN, errorMessage, error);
}

function extractErrorMessage(error: QueueErrorInput): string {
  if (error instanceof Error) {
    const pgCode = z
      .string()
      .min(1)
      .safeParse("code" in error ? error.code : undefined);
    const codeTag = pgCode.success ? ` [pg_code=${pgCode.data}]` : "";
    // SAFETY: error.cause is from Error instance, narrowed via instanceof Error branch; QueueErrorInput is safe union for recursion.
    const cause =
      error.cause != null ? ` (cause: ${extractErrorMessage(error.cause as QueueErrorInput)})` : "";
    return `${error.message}${codeTag}${cause}`;
  }

  if (z.string().safeParse(error).success) {
    // SAFETY: zod safeParse above guarantees error is string.
    return error as string;
  }

  if (error != null && error instanceof Object) {
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
    if ("status" in record && z.number().safeParse(record.status).success) {
      // SAFETY: zod safeParse above guarantees record.status is number.
      return `HTTP ${String(record.status as number)}`;
    }
  }

  return "Unknown error";
}

function isQueueError(error: QueueErrorInput): error is QueueError {
  return error instanceof QueueError;
}

export function isRetryableError(error: QueueErrorInput): boolean {
  if (isQueueError(error)) {
    return error.isRetryable();
  }
  return classifyQueueError(error).isRetryable();
}
