import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { validateEnvironment } from "@/lib/env";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint
 * Verifies environment config and service connectivity
 */
export async function GET() {
  const checks = {
    environment: false,
    supabase: false,
    r2: false,
    timestamp: new Date().toISOString(),
  };

  // Check environment variables
  try {
    validateEnvironment();
    checks.environment = true;
  } catch {
    return NextResponse.json(
      { status: "error", checks, error: "Environment validation failed" },
      { status: 500 },
    );
  }

  // Check Supabase connection
  try {
    const supabase = await createClient();
    await supabase.from("profiles").select("id").limit(1).single();
    // Error is okay if no profiles exist, we just want to verify connection
    checks.supabase = true;
  } catch (err) {
    console.error("Supabase health check failed:", err);
  }

  // Check R2 connection
  try {
    const r2Client = getR2Client();
    const R2_BUCKET = getR2Bucket();
    await r2Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
    checks.r2 = true;
  } catch (err) {
    console.error("R2 health check failed:", err);
  }

  const allHealthy = checks.environment && checks.supabase && checks.r2;

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
