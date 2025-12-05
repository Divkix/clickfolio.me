import { normalizeResumeData } from "@/lib/replicate";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReplicateWebhook } from "@/lib/utils/webhook-verification";

/**
 * Convert technical validation errors to user-friendly messages
 */
function makeUserFriendlyError(rawMessage: string): string {
  if (rawMessage.includes("Invalid email")) {
    return "We couldn't extract a valid email from your resume. Please ensure your email address is complete and clearly visible.";
  }
  if (rawMessage.includes("Invalid LinkedIn URL")) {
    return "The LinkedIn URL in your resume couldn't be parsed correctly. Please ensure it's a complete URL.";
  }
  if (rawMessage.includes("Invalid GitHub URL")) {
    return "The GitHub URL in your resume couldn't be parsed correctly. Please ensure it's a complete URL.";
  }
  if (rawMessage.includes("is required")) {
    const match = rawMessage.match(/Invalid resume data structure: (.+) is required/);
    if (match) {
      return `We couldn't find the ${match[1].toLowerCase()} in your resume. Please ensure it's clearly visible.`;
    }
  }
  // Default: strip technical prefix and return
  return rawMessage.replace("Invalid resume data structure: ", "Parsing issue: ");
}

export async function POST(request: Request) {
  try {
    // 1. Verify webhook signature
    const { isValid, body } = await verifyReplicateWebhook(request);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse payload
    const payload = JSON.parse(body);
    const { id: replicateJobId, status, output, error } = payload;

    console.log(`Webhook received: job=${replicateJobId}, status=${status}`);

    // 3. Only process completed events
    if (status !== "succeeded" && status !== "failed" && status !== "canceled") {
      return new Response("OK", { status: 200 });
    }

    // 4. Find resume by replicate_job_id (use admin client to bypass RLS)
    const supabase = createAdminClient();
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("id, user_id, status")
      .eq("replicate_job_id", replicateJobId)
      .single();

    if (fetchError || !resume) {
      console.error("Resume not found for job:", replicateJobId);
      return new Response("Resume not found", { status: 404 });
    }

    // 5. Skip if already processed (idempotency)
    if (resume.status === "completed" || resume.status === "failed") {
      console.log("Resume already processed, skipping");
      return new Response("OK", { status: 200 });
    }

    // 6. Handle success
    if (status === "succeeded") {
      if (!output?.extraction_schema_json) {
        console.error("Missing extraction_schema_json in output");
        await supabase
          .from("resumes")
          .update({
            status: "failed",
            error_message: "Missing parsed data in Replicate output",
          })
          .eq("id", resume.id);
        return new Response("OK", { status: 200 });
      }

      // Normalize and validate parsed data
      let normalizedContent;
      try {
        normalizedContent = normalizeResumeData(output.extraction_schema_json);
      } catch (validationError) {
        const rawMessage =
          validationError instanceof Error
            ? validationError.message
            : "Failed to parse resume data";

        // Make error message user-friendly
        const userMessage = makeUserFriendlyError(rawMessage);

        console.error("Validation failed:", rawMessage);

        await supabase
          .from("resumes")
          .update({
            status: "failed",
            error_message: userMessage,
          })
          .eq("id", resume.id);

        return new Response("OK", { status: 200 });
      }

      // Save to site_data
      const { error: upsertError } = await supabase.from("site_data").upsert(
        {
          user_id: resume.user_id,
          resume_id: resume.id,
          content: JSON.parse(JSON.stringify(normalizedContent)),
          last_published_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (upsertError) {
        console.error("Failed to save site_data:", upsertError);
        await supabase
          .from("resumes")
          .update({
            status: "failed",
            error_message: `Database error: ${upsertError.message}`,
          })
          .eq("id", resume.id);
        return new Response("OK", { status: 200 });
      }

      // Update resume status and store parsed content for caching
      await supabase
        .from("resumes")
        .update({
          status: "completed",
          parsed_at: new Date().toISOString(),
          parsed_content: JSON.parse(JSON.stringify(normalizedContent)), // Store for file hash cache
        })
        .eq("id", resume.id);

      console.log("Resume processing completed successfully");
    }

    // 7. Handle failure
    else if (status === "failed" || status === "canceled") {
      await supabase
        .from("resumes")
        .update({
          status: "failed",
          error_message: error || "AI parsing failed",
        })
        .eq("id", resume.id);

      console.log("Resume processing failed:", error);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
