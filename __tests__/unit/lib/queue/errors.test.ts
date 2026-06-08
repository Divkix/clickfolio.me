import { describe, expect, it } from "vite-plus/test";
import {
  classifyQueueError,
  isRetryableError,
  QueueError,
  QueueErrorType,
} from "@/lib/queue/errors";

describe("queue error handling", () => {
  describe("QueueError.toJSON()", () => {
    it("should return a JSON-serializable object with type, message, isRetryable", () => {
      const error = new QueueError(
        QueueErrorType.INVALID_PDF,
        "PDF is corrupted",
        new Error("Original error"),
      );

      const json = error.toJSON();

      expect(json).toHaveProperty("type", QueueErrorType.INVALID_PDF);
      expect(json).toHaveProperty("message", "PDF is corrupted");
      expect(json).toHaveProperty("isRetryable", false);
      expect(json).toHaveProperty("name", "QueueError");
      expect(json).toHaveProperty("originalError");
    });

    it("should have isRetryable=true for transient errors", () => {
      const transientError = new QueueError(
        QueueErrorType.DB_CONNECTION_ERROR,
        "DB connection failed",
      );

      const json = transientError.toJSON();

      expect(json.isRetryable).toBe(true);
    });

    it("should be parseable after JSON.stringify", () => {
      const error = new QueueError(QueueErrorType.MALFORMED_RESPONSE, "Invalid JSON response");

      const serialized = JSON.stringify(error.toJSON());
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveProperty("type", QueueErrorType.MALFORMED_RESPONSE);
      expect(parsed).toHaveProperty("message", "Invalid JSON response");
      expect(parsed).toHaveProperty("isRetryable", false);
    });
  });

  describe("classifyQueueError", () => {
    it("should return QueueError with correct type for invalid PDF", () => {
      const error = classifyQueueError(new Error("Invalid PDF format"));

      expect(error).toBeInstanceOf(QueueError);
      expect(error.type).toBe(QueueErrorType.INVALID_PDF);
      expect(error.toJSON()).toHaveProperty("type", QueueErrorType.INVALID_PDF);
    });

    it("should return QueueError with correct type for transient DB errors", () => {
      const error = classifyQueueError(new Error("D1_ERROR: connection refused"));

      expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
      expect(error.isRetryable()).toBe(true);
    });

    it.each([
      ["database unavailable", QueueErrorType.DB_CONNECTION_ERROR],
      ["db timeout while opening transaction", QueueErrorType.DB_CONNECTION_ERROR],
      ["deadline exceeded in worker timeout", QueueErrorType.SERVICE_BINDING_TIMEOUT],
      ["request took too long and exceeded time limit", QueueErrorType.SERVICE_BINDING_TIMEOUT],
      ["R2 throttle: too many requests 429", QueueErrorType.R2_THROTTLE],
      ["R2 service temporarily unavailable", QueueErrorType.R2_THROTTLE],
      ["not a pdf and cannot parse pdf", QueueErrorType.INVALID_PDF],
      ["encrypted pdf password protected", QueueErrorType.INVALID_PDF],
      ["extracted resume text is empty", QueueErrorType.INVALID_PDF],
      ["NoObjectGeneratedError from provider", QueueErrorType.AI_PROVIDER_ERROR],
      ["API request failed with provider error", QueueErrorType.AI_PROVIDER_ERROR],
      ["model unavailable due to insufficient credits", QueueErrorType.AI_PROVIDER_ERROR],
      ["HTTP 502 bad gateway service unavailable", QueueErrorType.AI_PROVIDER_ERROR],
      ["invalid json unexpected token", QueueErrorType.MALFORMED_RESPONSE],
      ["invalid json response from ai", QueueErrorType.MALFORMED_RESPONSE],
      ["ai parsing failed", QueueErrorType.MALFORMED_RESPONSE],
      ["worker not available service not found", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["pdf worker not available", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["R2 binding not available", QueueErrorType.SERVICE_BINDING_NOT_FOUND],
      ["object not found 404", QueueErrorType.FILE_NOT_FOUND],
      ["failed to fetch pdf from r2", QueueErrorType.FILE_NOT_FOUND],
      ["r2 object does not exist no such key", QueueErrorType.FILE_NOT_FOUND],
      ["schema validation zod error", QueueErrorType.PARSE_VALIDATION_ERROR],
      ["required field missing type mismatch", QueueErrorType.PARSE_VALIDATION_ERROR],
    ])("classifies %s", (message, expectedType) => {
      const error = classifyQueueError(new Error(message));

      expect(error.type).toBe(expectedType);
      expect(error.isRetryable()).toBe(
        [
          QueueErrorType.DB_CONNECTION_ERROR,
          QueueErrorType.SERVICE_BINDING_TIMEOUT,
          QueueErrorType.R2_THROTTLE,
          QueueErrorType.AI_PROVIDER_ERROR,
        ].includes(expectedType),
      );
    });

    it("extracts messages from strings, causes, response-like objects, and unknown values", () => {
      expect(classifyQueueError("api request failed").type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
      expect(classifyQueueError(new Error("outer", { cause: new Error("invalid pdf") })).type).toBe(
        QueueErrorType.INVALID_PDF,
      );
      expect(classifyQueueError({ message: "binding not available" }).type).toBe(
        QueueErrorType.SERVICE_BINDING_NOT_FOUND,
      );
      expect(classifyQueueError({ error: "validation error" }).type).toBe(
        QueueErrorType.PARSE_VALIDATION_ERROR,
      );
      expect(classifyQueueError({ status: 429 }).type).toBe(QueueErrorType.R2_THROTTLE);
      expect(classifyQueueError(null).type).toBe(QueueErrorType.UNKNOWN);
    });

    it("serializes non-Error original errors and checks retryability for unknown values", () => {
      const original = { error: "validation error" };
      const queueError = new QueueError(
        QueueErrorType.PARSE_VALIDATION_ERROR,
        "schema validation",
        original,
      );

      expect(queueError.toJSON().originalError).toBe(original);
      expect(isRetryableError("timeout")).toBe(true);
      expect(isRetryableError({ error: "invalid pdf" })).toBe(false);
    });

    it("handles missing V8 stack helpers and malformed response-like objects", () => {
      const errorConstructor = Error as unknown as {
        captureStackTrace?: typeof Error.captureStackTrace | undefined;
      };
      const originalCaptureStackTrace = errorConstructor.captureStackTrace;
      errorConstructor.captureStackTrace = undefined;

      try {
        const queueError = new QueueError(QueueErrorType.UNKNOWN, "no stack helper");
        expect(queueError.name).toBe("QueueError");
      } finally {
        errorConstructor.captureStackTrace = originalCaptureStackTrace;
      }

      expect(classifyQueueError({ message: 123, error: 456, status: "429" }).type).toBe(
        QueueErrorType.UNKNOWN,
      );
    });

    it("should allow proper JSON serialization for DLQ/retry consumers", () => {
      // Simulates the scenario from issue #91:
      // DLQ consumer and retry route expect to parse lastAttemptError as JSON
      // with a .type property to determine error classification
      const classifiedError = classifyQueueError(
        new Error("PDF is password-protected and encrypted"),
      );

      // This is what SHOULD be stored (JSON string):
      const serialized = JSON.stringify(classifiedError.toJSON());

      // DLQ consumer and retry route parse it back:
      const parsed = JSON.parse(serialized);

      // They need .type to determine if it's permanent or retryable
      expect(parsed).toHaveProperty("type", QueueErrorType.INVALID_PDF);
      expect(parsed).toHaveProperty("isRetryable", false);

      // isPermanentErrorType() checks these types
      const permanentTypes = [
        QueueErrorType.INVALID_PDF,
        QueueErrorType.MALFORMED_RESPONSE,
        QueueErrorType.FILE_NOT_FOUND,
        QueueErrorType.SERVICE_BINDING_NOT_FOUND,
        QueueErrorType.PARSE_VALIDATION_ERROR,
      ];
      expect(permanentTypes).toContain(parsed.type);
    });
  });

  describe("error format for consumer storage (issue #91)", () => {
    it("stores JSON format that can be parsed by DLQ and retry consumers", () => {
      // This test verifies the fix for issue #91:
      // The consumer should store JSON.stringify(classifiedError.toJSON())
      // instead of classifiedError.message (plain string)

      const classifiedError = classifyQueueError(new Error("Invalid PDF: cannot parse file"));

      // WRONG: storing plain string (what was happening before fix)
      const wrongStorage = classifiedError.message;
      expect(() => {
        const parsed = JSON.parse(wrongStorage);
        // This will throw because "Invalid PDF: cannot parse file" is not valid JSON
        return parsed.type;
      }).toThrow(); // Expect SyntaxError

      // CORRECT: storing JSON string (what should happen after fix)
      const correctStorage = JSON.stringify(classifiedError.toJSON());
      const parsed = JSON.parse(correctStorage);

      // DLQ consumer and retry route need this:
      expect(parsed).toHaveProperty("type");
      expect(parsed).toHaveProperty("message");
      expect(parsed).toHaveProperty("isRetryable");

      // For permanent error detection in retry route:
      expect(typeof parsed.type).toBe("string");
    });

    it("allows retry consumer to detect permanent errors", () => {
      // Simulates retry route logic:
      // https://github.com/Divkix/clickfolio.me/blob/main/app/api/resume/retry/route.ts#L103-116

      const permanentErrors = [
        { error: new Error("Invalid PDF"), type: QueueErrorType.INVALID_PDF },
        { error: new Error("Malformed response"), type: QueueErrorType.MALFORMED_RESPONSE },
      ];

      for (const { error, type } of permanentErrors) {
        const classifiedError = classifyQueueError(error);

        // Must use JSON.stringify(.toJSON()) to get parseable format
        const storedError = JSON.stringify(classifiedError.toJSON());
        const lastError = JSON.parse(storedError);

        // isPermanentErrorType() logic from retry route:
        const isPermanent = [
          QueueErrorType.INVALID_PDF,
          QueueErrorType.MALFORMED_RESPONSE,
          QueueErrorType.FILE_NOT_FOUND,
          QueueErrorType.SERVICE_BINDING_NOT_FOUND,
          QueueErrorType.PARSE_VALIDATION_ERROR,
        ].includes(lastError.type);

        expect(lastError.type).toBe(type);
        expect(isPermanent).toBe(true);
        expect(lastError.isRetryable).toBe(false);
      }
    });

    it("allows DLQ consumer to extract error type for alerts", () => {
      // Simulates DLQ consumer logic:
      // https://github.com/Divkix/clickfolio.me/blob/main/lib/queue/dlq-consumer.ts#L103-112

      const classifiedError = classifyQueueError(
        new Error("Failed to fetch PDF from R2: my-file.pdf"),
      );

      // Must use JSON.stringify(.toJSON()) to get parseable format
      const storedError = JSON.stringify(classifiedError.toJSON());

      let errorType = QueueErrorType.UNKNOWN;
      try {
        const parsed = JSON.parse(storedError);
        errorType = parsed.type || QueueErrorType.UNKNOWN;
      } catch {
        // Ignore parse errors
      }

      // DLQ should get actual error type, not "unknown"
      expect(errorType).toBe(QueueErrorType.FILE_NOT_FOUND);
      expect(errorType).not.toBe(QueueErrorType.UNKNOWN);
    });
  });
});
