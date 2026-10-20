// Wire-level parse error types. This module stays free of Effect so client code
// (lib/resume/lifecycle.ts) can read the enum without bundling the runtime.
export enum ParseErrorType {
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
