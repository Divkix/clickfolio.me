import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getR2Binding, R2 } from "@/lib/r2";
import { checkIPRateLimit, getClientIP } from "@/lib/utils/ip-rate-limit";
import { generateTempKey, MAX_FILE_SIZE, validatePDFBuffer } from "@/lib/utils/validation";

// Minimum file size for a valid PDF (100 bytes)
const MIN_PDF_SIZE = 100;

/**
 * POST /api/upload
 * Direct file upload to R2 via Worker binding (replaces presigned URLs)
 *
 * Headers:
 *   - Content-Type: application/pdf (required)
 *   - Content-Length: file size in bytes (required)
 *   - X-Filename: original filename (required)
 *
 * Returns:
 *   - key: R2 object key (temp/{uuid}/{filename})
 *   - file_hash: SHA-256 hash of file content
 *   - remaining: { hourly, daily } rate limit remaining
 */
export async function POST(request: Request) {
  try {
    // 0. Get Cloudflare env bindings for R2
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;

    // Get R2 binding for direct operations
    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return NextResponse.json({ error: "Storage service unavailable" }, { status: 503 });
    }

    // 1. Validate Content-Type
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/pdf")) {
      return NextResponse.json({ error: "Content-Type must be application/pdf" }, { status: 400 });
    }

    // 2. Validate Content-Length before reading body
    const contentLengthHeader = request.headers.get("content-length");
    if (!contentLengthHeader) {
      return NextResponse.json({ error: "Content-Length header is required" }, { status: 411 });
    }

    const contentLength = parseInt(contentLengthHeader, 10);
    if (Number.isNaN(contentLength) || contentLength <= 0) {
      return NextResponse.json({ error: "Invalid Content-Length header" }, { status: 400 });
    }

    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds limit (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB maximum)` },
        { status: 413 },
      );
    }

    if (contentLength < MIN_PDF_SIZE) {
      return NextResponse.json({ error: "File appears to be empty or corrupted" }, { status: 400 });
    }

    // 3. Get filename from header
    const filename = request.headers.get("x-filename");
    if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
      return NextResponse.json({ error: "X-Filename header is required" }, { status: 400 });
    }

    if (filename.length > 255) {
      return NextResponse.json(
        { error: "Filename too long (max 255 characters)" },
        { status: 400 },
      );
    }

    // 4. Extract client IP for rate limiting
    const clientIP = getClientIP(request);

    // 5. Check IP-based rate limit BEFORE any processing
    const rateLimit = await checkIPRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate Limit Exceeded",
          message: rateLimit.message,
          remaining: rateLimit.remaining,
        },
        { status: 429 },
      );
    }

    // 6. Read the request body
    const buffer = await request.arrayBuffer();

    // Verify actual size matches Content-Length
    if (buffer.byteLength !== contentLength) {
      return NextResponse.json({ error: "Content-Length mismatch" }, { status: 400 });
    }

    // 7. Validate PDF magic number
    const pdfValidation = validatePDFBuffer(buffer);
    if (!pdfValidation.valid) {
      return NextResponse.json(
        { error: pdfValidation.error || "Invalid PDF file" },
        { status: 400 },
      );
    }

    // 8. Generate temp key
    const key = generateTempKey(filename);

    // 9. Compute SHA-256 hash server-side
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 10. Store to R2 via binding
    try {
      await R2.put(r2Binding, key, buffer, {
        contentType: "application/pdf",
        customMetadata: {
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
          fileHash,
        },
      });
    } catch (r2Error) {
      console.error("R2 upload error:", r2Error);
      return NextResponse.json({ error: "Failed to store file" }, { status: 500 });
    }

    // 11. Return success with rate limit info
    return NextResponse.json(
      {
        key,
        file_hash: fileHash,
        remaining: rateLimit.remaining,
      },
      {
        headers: {
          "X-RateLimit-Remaining-Hourly": String(rateLimit.remaining.hourly),
          "X-RateLimit-Remaining-Daily": String(rateLimit.remaining.daily),
        },
      },
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
