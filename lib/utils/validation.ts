import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "stream";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPE = "application/pdf";

export function validatePDF(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size must be less than 10MB" };
  }
  if (file.type !== ALLOWED_FILE_TYPE) {
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
export function sanitizeFilename(filename: string): string {
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
    safe = safe + ".pdf";
  }
  return safe;
}

export function generateTempKey(filename: string): string {
  const uuid = crypto.randomUUID();
  const safeFilename = sanitizeFilename(filename);
  return `temp/${uuid}/${safeFilename}`;
}

/**
 * Validates PDF file by checking magic number (%PDF)
 * Downloads first 5 bytes from R2 to verify file signature
 */
export async function validatePDFMagicNumber(
  r2Client: S3Client,
  bucket: string,
  key: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Download only first 5 bytes to check for %PDF signature
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: "bytes=0-4", // Get first 5 bytes
    });

    const response = await r2Client.send(command);
    const body = response.Body;

    if (!body) {
      return { valid: false, error: "Could not read file" };
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = body as Readable;
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    const buffer = Buffer.concat(chunks);

    // Check for PDF magic number: 0x25 0x50 0x44 0x46 = %PDF
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 // F
    ) {
      return { valid: true };
    }

    return {
      valid: false,
      error: "File is not a valid PDF (invalid magic number)",
    };
  } catch (error) {
    console.error("PDF validation error:", error);
    return { valid: false, error: "Failed to validate PDF file" };
  }
}

/**
 * Validates request body size before parsing
 * Prevents DoS attacks with massive JSON payloads
 *
 * @param request - The incoming HTTP request
 * @param maxSizeBytes - Maximum allowed size in bytes (default: 10MB)
 * @returns Validation result with optional error message
 */
export function validateRequestSize(
  request: Request,
  maxSizeBytes: number = 10_000_000, // 10MB default
): { valid: boolean; error?: string } {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    // If no content-length header, we'll let the parser handle it
    // (it will fail if too large)
    return { valid: true };
  }

  const size = parseInt(contentLength, 10);

  if (isNaN(size)) {
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
