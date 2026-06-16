/**
 * File validation utilities for PDF uploads and request body size checks.
 *
 * Enforces file type, size limits, and magic-number validation for PDFs.
 * All size limits are configurable via MAX_UPLOAD_SIZE_MB env var.
 */

const DEFAULT_MAX_FILE_SIZE_MB = 5;

/** Maximum allowed file size in bytes (default 5MB, configurable via env). */
export const MAX_FILE_SIZE =
  (Number(process.env.MAX_UPLOAD_SIZE_MB) || DEFAULT_MAX_FILE_SIZE_MB) * 1024 * 1024;

/** Human-readable label for the max file size (e.g., "5MB"). */
export const MAX_FILE_SIZE_LABEL = `${DEFAULT_MAX_FILE_SIZE_MB}MB`;

/**
 * Validates a client-side File object for upload.
 *
 * Checks file type is PDF and size is within MAX_FILE_SIZE.
 *
 * @param file - The File object to validate
 * @returns Validation result with optional error message
 */
export function validatePDF(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE_LABEL}` };
  }
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed" };
  }
  return { valid: true };
}

/**
 * Sanitizes filename to prevent path traversal and injection attacks
 * - Removes path traversal attempts (../)
 * - Removes path separators (/ and \)
 * - Only allows alphanumeric, dots, hyphens, underscores
 * - Limits length to 255 characters
 * - Ensures .pdf extension
 */
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, "");
  // Remove path separators
  safe = safe.replace(/[/\\]/g, "");
  // Only allow alphanumeric, dots, hyphens, underscores
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Limit length
  safe = safe.slice(0, 255);
  // Ensure it's not empty and has .pdf extension
  if (!safe || safe.length === 0) {
    safe = "resume.pdf";
  }
  if (!safe.endsWith(".pdf")) {
    safe = `${safe}.pdf`;
  }
  return safe;
}

/**
 * Generates a secure temporary R2 key for an uploaded file.
 *
 * Format: `temp/{uuid}/{sanitized-filename}`.
 * Sanitizes the filename to prevent path traversal and injection.
 *
 * @param filename - Original filename from the upload
 * @returns Safe temporary R2 object key
 */
export function generateTempKey(filename: string): string {
  const uuid = crypto.randomUUID();
  const safeFilename = sanitizeFilename(filename);
  return `temp/${uuid}/${safeFilename}`;
}

/**
 * Validates PDF buffer by checking magic number (%PDF)
 * Used for server-side validation before storing to R2
 */
export function validatePDFBuffer(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  const bytes = new Uint8Array(buffer);

  // Check for PDF magic number: 0x25 0x50 0x44 0x46 = %PDF
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    error: "File is not a valid PDF (invalid magic number)",
  };
}

/**
 * Validates request body size before parsing
 * Prevents DoS attacks with massive JSON payloads
 *
 * @param request - The incoming HTTP request
 * @param maxSizeBytes - Maximum allowed size in bytes (default: 5MB)
 * @returns Validation result with optional error message
 */
export function validateRequestSize(
  request: Request,
  maxSizeBytes: number = 5_000_000, // 5MB default
): { valid: boolean; error?: string } {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    // If no content-length header, we'll let the parser handle it
    // (it will fail if too large)
    return { valid: true };
  }

  const size = parseInt(contentLength, 10);

  if (Number.isNaN(size)) {
    return { valid: false, error: "Invalid content-length header" };
  }

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Request body too large (${(size / 1_000_000).toFixed(1)}MB). Maximum size is ${(maxSizeBytes / 1_000_000).toFixed(1)}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Reads and JSON-parses a request body with a hard byte cap, independent of the
 * Content-Length header (which a client may omit or lie about). Returns a
 * discriminated result so callers can map failures to HTTP 413 / 400.
 *
 * @param request - The incoming HTTP request
 * @param maxSizeBytes - Maximum allowed body size in bytes (default: 5MB)
 */
export async function readJsonWithLimit(
  request: Request,
  maxSizeBytes: number = 5_000_000,
): Promise<
  { ok: true; data: unknown } | { ok: false; reason: "too_large" | "invalid_json"; error: string }
> {
  if (!request.body) {
    return { ok: true, data: undefined };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxSizeBytes) {
        await reader.cancel();
        return {
          ok: false,
          reason: "too_large",
          error: `Request body too large. Maximum size is ${(maxSizeBytes / 1_000_000).toFixed(1)}MB.`,
        };
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, reason: "invalid_json", error: "Invalid JSON in request body" };
  }
}
