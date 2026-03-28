/**
 * Queue Error Classification Tests
 *
 * Tests for the error classification system that determines
 * whether errors are retryable (transient) or permanent.
 */

import { describe, expect, it } from "vitest";
import {
  classifyQueueError,
  isRetryableError,
  QueueError,
  QueueErrorType,
} from "@/lib/queue/errors";

describe("Queue Error System", () => {
  describe("QueueErrorType enum", () => {
    it("should define all 10 error types", () => {
      const errorTypes = Object.values(QueueErrorType);
      expect(errorTypes).toHaveLength(10);
    });

    it("should include transient error types", () => {
      expect(QueueErrorType.DB_CONNECTION_ERROR).toBe("db_connection_error");
      expect(QueueErrorType.SERVICE_BINDING_TIMEOUT).toBe("service_binding_timeout");
      expect(QueueErrorType.R2_THROTTLE).toBe("r2_throttle");
      expect(QueueErrorType.AI_PROVIDER_ERROR).toBe("ai_provider_error");
    });

    it("should include permanent error types", () => {
      expect(QueueErrorType.INVALID_PDF).toBe("invalid_pdf");
      expect(QueueErrorType.MALFORMED_RESPONSE).toBe("malformed_response");
      expect(QueueErrorType.SERVICE_BINDING_NOT_FOUND).toBe("service_binding_not_found");
      expect(QueueErrorType.FILE_NOT_FOUND).toBe("file_not_found");
      expect(QueueErrorType.PARSE_VALIDATION_ERROR).toBe("parse_validation_error");
      expect(QueueErrorType.UNKNOWN).toBe("unknown");
    });
  });

  describe("QueueError class", () => {
    it("should create error with correct properties", () => {
      const error = new QueueError(QueueErrorType.INVALID_PDF, "PDF is corrupted");
      expect(error.name).toBe("QueueError");
      expect(error.type).toBe(QueueErrorType.INVALID_PDF);
      expect(error.message).toBe("PDF is corrupted");
    });

    it("should store original error", () => {
      const original = new Error("Original error");
      const error = new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "AI failed", original);
      expect(error.originalError).toBe(original);
    });

    it("should correctly identify retryable errors", () => {
      const transientErrors = [
        QueueErrorType.DB_CONNECTION_ERROR,
        QueueErrorType.SERVICE_BINDING_TIMEOUT,
        QueueErrorType.R2_THROTTLE,
        QueueErrorType.AI_PROVIDER_ERROR,
      ];

      for (const type of transientErrors) {
        const error = new QueueError(type, "Test error");
        expect(error.isRetryable()).toBe(true);
      }
    });

    it("should correctly identify non-retryable errors", () => {
      const permanentErrors = [
        QueueErrorType.INVALID_PDF,
        QueueErrorType.MALFORMED_RESPONSE,
        QueueErrorType.SERVICE_BINDING_NOT_FOUND,
        QueueErrorType.FILE_NOT_FOUND,
        QueueErrorType.PARSE_VALIDATION_ERROR,
        QueueErrorType.UNKNOWN,
      ];

      for (const type of permanentErrors) {
        const error = new QueueError(type, "Test error");
        expect(error.isRetryable()).toBe(false);
      }
    });

    it("should serialize to JSON correctly", () => {
      const original = new Error("Original");
      const error = new QueueError(QueueErrorType.R2_THROTTLE, "Rate limited", original);
      const json = error.toJSON();

      expect(json).toEqual({
        name: "QueueError",
        type: "r2_throttle",
        message: "Rate limited",
        isRetryable: true,
        originalError: {
          name: "Error",
          message: "Original",
        },
      });
    });

    it("should handle non-Error originalError in toJSON", () => {
      const error = new QueueError(QueueErrorType.INVALID_PDF, "Bad PDF", "string error");
      const json = error.toJSON();

      expect(json.originalError).toBe("string error");
    });

    it("should capture stack trace when available", () => {
      const error = new QueueError(QueueErrorType.UNKNOWN, "Test");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("QueueError");
    });
  });

  describe("error classification - transient errors", () => {
    describe("database connection errors", () => {
      it("should classify D1_ERROR as DB_CONNECTION_ERROR", () => {
        const error = classifyQueueError(new Error("D1_ERROR: Connection failed"));
        expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify connection refused", () => {
        const error = classifyQueueError(new Error("database connection refused"));
        expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify SQLITE_BUSY", () => {
        const error = classifyQueueError(new Error("SQLITE_BUSY: database is locked"));
        expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify database unavailable", () => {
        const error = classifyQueueError(new Error("database unavailable"));
        expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify transaction failed", () => {
        const error = classifyQueueError(new Error("transaction failed"));
        expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
        expect(error.isRetryable()).toBe(true);
      });
    });

    describe("service binding timeout errors", () => {
      it("should classify timeout", () => {
        const error = classifyQueueError(new Error("Request timeout"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify timed out", () => {
        const error = classifyQueueError(new Error("Connection timed out"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify deadline exceeded", () => {
        const error = classifyQueueError(new Error("deadline exceeded"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify worker timeout", () => {
        const error = classifyQueueError(new Error("worker timeout"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify request took too long", () => {
        const error = classifyQueueError(new Error("request took too long"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
        expect(error.isRetryable()).toBe(true);
      });
    });

    describe("R2 throttle errors", () => {
      it("should classify R2 throttle", () => {
        const error = classifyQueueError(new Error("R2 throttle"));
        expect(error.type).toBe(QueueErrorType.R2_THROTTLE);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify rate limit", () => {
        const error = classifyQueueError(new Error("rate limit exceeded"));
        expect(error.type).toBe(QueueErrorType.R2_THROTTLE);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify 429 status", () => {
        const error = classifyQueueError(new Error("HTTP 429"));
        expect(error.type).toBe(QueueErrorType.R2_THROTTLE);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify R2 temporarily unavailable", () => {
        const error = classifyQueueError(new Error("R2 temporarily unavailable"));
        expect(error.type).toBe(QueueErrorType.R2_THROTTLE);
        expect(error.isRetryable()).toBe(true);
      });
    });

    describe("AI provider errors", () => {
      it("should classify NoObjectGeneratedError", () => {
        const error = classifyQueueError(new Error("NoObjectGeneratedError: no object generated"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify API error", () => {
        const error = classifyQueueError(new Error("API error occurred"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify model unavailable", () => {
        const error = classifyQueueError(new Error("model unavailable"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify insufficient credits", () => {
        const error = classifyQueueError(new Error("insufficient credits"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify 5xx errors", () => {
        const error = classifyQueueError(new Error("HTTP 502"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify internal server error", () => {
        const error = classifyQueueError(new Error("internal server error"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });

      it("should classify bad gateway", () => {
        const error = classifyQueueError(new Error("bad gateway"));
        expect(error.type).toBe(QueueErrorType.AI_PROVIDER_ERROR);
        expect(error.isRetryable()).toBe(true);
      });
    });
  });

  describe("error classification - permanent errors", () => {
    describe("invalid PDF errors", () => {
      it("should classify invalid PDF", () => {
        const error = classifyQueueError(new Error("invalid PDF format"));
        expect(error.type).toBe(QueueErrorType.INVALID_PDF);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify corrupt PDF", () => {
        const error = classifyQueueError(new Error("corrupt PDF file"));
        expect(error.type).toBe(QueueErrorType.INVALID_PDF);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify password protected PDF", () => {
        const error = classifyQueueError(new Error("PDF is encrypted and password protected"));
        expect(error.type).toBe(QueueErrorType.INVALID_PDF);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify empty extracted text", () => {
        const error = classifyQueueError(new Error("extracted resume text is empty"));
        expect(error.type).toBe(QueueErrorType.INVALID_PDF);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify PDF extraction failed", () => {
        const error = classifyQueueError(new Error("cannot parse PDF: extraction failed"));
        expect(error.type).toBe(QueueErrorType.INVALID_PDF);
        expect(error.isRetryable()).toBe(false);
      });
    });

    describe("malformed response errors", () => {
      it("should classify invalid JSON", () => {
        const error = classifyQueueError(new Error("invalid JSON response"));
        expect(error.type).toBe(QueueErrorType.MALFORMED_RESPONSE);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify JSON parse error", () => {
        const error = classifyQueueError(new Error("JSON parse error: unexpected token"));
        expect(error.type).toBe(QueueErrorType.MALFORMED_RESPONSE);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify AI parsing failed", () => {
        const error = classifyQueueError(new Error("AI parsing failed"));
        expect(error.type).toBe(QueueErrorType.MALFORMED_RESPONSE);
        expect(error.isRetryable()).toBe(false);
      });
    });

    describe("service binding not found errors", () => {
      it("should classify worker not available", () => {
        const error = classifyQueueError(new Error("worker not available"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify binding not available", () => {
        const error = classifyQueueError(new Error("binding not available"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify R2 binding not available", () => {
        const error = classifyQueueError(new Error("R2 binding not available"));
        expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });
    });

    describe("file not found errors", () => {
      it("should classify file not found", () => {
        const error = classifyQueueError(new Error("file not found in R2"));
        expect(error.type).toBe(QueueErrorType.FILE_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify object not found", () => {
        const error = classifyQueueError(new Error("object not found"));
        expect(error.type).toBe(QueueErrorType.FILE_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify 404", () => {
        const error = classifyQueueError(new Error("HTTP 404"));
        expect(error.type).toBe(QueueErrorType.FILE_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify failed to fetch PDF from R2", () => {
        const error = classifyQueueError(new Error("failed to fetch PDF from R2"));
        expect(error.type).toBe(QueueErrorType.FILE_NOT_FOUND);
        expect(error.isRetryable()).toBe(false);
      });
    });

    describe("parse validation errors", () => {
      it("should classify validation error", () => {
        const error = classifyQueueError(new Error("validation error: required field missing"));
        expect(error.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify Zod error", () => {
        const error = classifyQueueError(new Error("Zod validation error"));
        expect(error.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
        expect(error.isRetryable()).toBe(false);
      });

      it("should classify type mismatch", () => {
        const error = classifyQueueError(new Error("type mismatch in field"));
        expect(error.type).toBe(QueueErrorType.PARSE_VALIDATION_ERROR);
        expect(error.isRetryable()).toBe(false);
      });
    });
  });

  describe("error message extraction", () => {
    it("should extract message from Error object", () => {
      const error = classifyQueueError(new Error("timeout"));
      expect(error.message).toBe("timeout");
    });

    it("should extract message from string", () => {
      const error = classifyQueueError("direct string error");
      expect(error.message).toBe("direct string error");
    });

    it("should extract message from object with message property", () => {
      const error = classifyQueueError({ message: "object message" });
      expect(error.message).toBe("object message");
    });

    it("should extract message from object with error property", () => {
      const error = classifyQueueError({ error: "error property" });
      expect(error.message).toBe("error property");
    });

    it("should extract status from HTTP-like object", () => {
      const error = classifyQueueError({ status: 500 });
      expect(error.message).toBe("HTTP 500");
    });

    it("should handle unknown error types", () => {
      const error = classifyQueueError(null);
      expect(error.message).toBe("Unknown error");
      expect(error.type).toBe(QueueErrorType.UNKNOWN);
    });

    it("should handle undefined", () => {
      const error = classifyQueueError(undefined);
      expect(error.message).toBe("Unknown error");
    });

    it("should handle nested error cause", () => {
      const cause = new Error("underlying cause");
      const error = new Error("outer error", { cause });
      const classified = classifyQueueError(error);
      expect(classified.message).toContain("outer error");
      expect(classified.message).toContain("underlying cause");
    });
  });

  describe("isRetryableError helper", () => {
    it("should return true for retryable QueueError", () => {
      const error = new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "AI down");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for permanent QueueError", () => {
      const error = new QueueError(QueueErrorType.INVALID_PDF, "Corrupt");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should classify and check retryable raw error", () => {
      expect(isRetryableError(new Error("timeout"))).toBe(true);
    });

    it("should classify and check permanent raw error", () => {
      expect(isRetryableError(new Error("invalid PDF"))).toBe(false);
    });

    it("should handle string errors", () => {
      expect(isRetryableError("database connection error")).toBe(true);
    });
  });

  describe("pattern matching priority", () => {
    it("should match first applicable pattern", () => {
      // "timeout" appears in multiple patterns but should match SERVICE_BINDING_TIMEOUT
      const error = classifyQueueError(new Error("timeout"));
      expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
    });

    it("should match patterns in order they appear in ERROR_PATTERNS", () => {
      // "timeout" appears earlier in the pattern list than "R2 throttle"
      // so it will match first - the behavior is order-dependent
      const error = classifyQueueError(new Error("R2 throttle timeout"));
      expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
    });
  });

  describe("edge cases", () => {
    it("should handle empty error message", () => {
      const error = classifyQueueError(new Error(""));
      expect(error.type).toBe(QueueErrorType.UNKNOWN);
    });

    it("should handle very long error messages", () => {
      const longMessage = "timeout".repeat(1000);
      const error = classifyQueueError(new Error(longMessage));
      expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
    });

    it("should handle special characters in error messages", () => {
      const error = classifyQueueError(new Error("Error: D1_ERROR [SQLITE_BUSY]"));
      expect(error.type).toBe(QueueErrorType.DB_CONNECTION_ERROR);
    });

    it("should handle case insensitive matching", () => {
      const error = classifyQueueError(new Error("TIMEOUT"));
      expect(error.type).toBe(QueueErrorType.SERVICE_BINDING_TIMEOUT);
    });
  });
});
