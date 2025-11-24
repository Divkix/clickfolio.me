import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { generateTempKey } from "@/lib/utils/validation";

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    if (filename.length > 255) {
      return NextResponse.json(
        { error: "Filename too long (max 255 characters)" },
        { status: 400 },
      );
    }

    const key = generateTempKey(filename);
    const r2Client = getR2Client();
    const R2_BUCKET = getR2Bucket();

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: "application/pdf",
      ChecksumAlgorithm: undefined, // Explicitly disable checksums for R2 compatibility
    });

    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // 1 hour
      // Sign content-type and content-length to enforce validation
      signableHeaders: new Set(["content-type", "content-length"]),
      // Prevent hoisting of content-length to enable client-side enforcement
      unhoistableHeaders: new Set(["content-length"]),
    });

    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
