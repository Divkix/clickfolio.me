import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { generatePresignedPutUrl } from "@/lib/r2";
import { checkIPRateLimit, getClientIP } from "@/lib/utils/ip-rate-limit";
import { generateTempKey, MAX_FILE_SIZE } from "@/lib/utils/validation";

// Minimum file size for a valid PDF (100 bytes)
const MIN_PDF_SIZE = 100;

export async function POST(request: Request) {
  try {
    // 0. Get Cloudflare env bindings for R2 secrets
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;

    // 1. Extract client IP for rate limiting
    const clientIP = getClientIP(request);

    // 2. Check IP-based rate limit BEFORE any processing
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

    // 3. Parse and validate request body
    let body: { filename?: string; contentLength?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { filename, contentLength } = body;

    // 4. Validate filename
    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    if (filename.length > 255) {
      return NextResponse.json(
        { error: "Filename too long (max 255 characters)" },
        { status: 400 },
      );
    }

    // 5. Validate content length (file size enforcement at presign time)
    if (typeof contentLength !== "number" || contentLength <= 0) {
      return NextResponse.json(
        { error: "Content-Length is required and must be positive" },
        { status: 400 },
      );
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

    // 6. Generate temp key and presigned URL using aws4fetch (lightweight presigner)
    const key = generateTempKey(filename);

    const uploadUrl = await generatePresignedPutUrl(
      key,
      "application/pdf",
      contentLength,
      3600, // 1 hour
      typedEnv,
    );

    // 7. Return success with rate limit info
    return NextResponse.json(
      { uploadUrl, key },
      {
        headers: {
          "X-RateLimit-Remaining-Hourly": String(rateLimit.remaining.hourly),
          "X-RateLimit-Remaining-Daily": String(rateLimit.remaining.daily),
        },
      },
    );
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
