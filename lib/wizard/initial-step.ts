import type { ClaimResponse } from "@/lib/types/api";
import type { ResumeContent } from "@/lib/types/database";
import { clearPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

export interface PendingUpload {
  key: string;
  file_hash: string | null;
}

interface LatestStatus {
  id?: string;
  status?: string;
}

export type WizardStart =
  | { kind: "claim-first"; pendingUpload: PendingUpload }
  | { kind: "review"; content: ResumeContent }
  | { kind: "redirect-waiting"; resumeId: string }
  | { kind: "upload" };

export function decideWizardStart({
  pendingUpload,
  siteContent,
  latestStatus,
}: {
  pendingUpload: PendingUpload | null;
  siteContent: ResumeContent | null;
  latestStatus: LatestStatus | null;
}): WizardStart {
  if (pendingUpload) return { kind: "claim-first", pendingUpload };

  if (siteContent) return { kind: "review", content: siteContent };

  if (latestStatus?.status === "processing" && latestStatus.id) {
    return { kind: "redirect-waiting", resumeId: latestStatus.id };
  }

  return { kind: "upload" };
}

/** A claim is a client-side write; only content fetched after it can seed the wizard. */
export async function runClaimThenLoad(pendingUpload: PendingUpload, fetchImpl = fetch) {
  const response = await fetchImpl("/api/resume/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pendingUpload),
  });

  // SAFETY: The claim endpoint returns this server-controlled wire shape; required fields are checked below.
  const claim = (await response.json()) as ClaimResponse;

  if (!response.ok)
    throw new Error(claim.error || "We couldn't save your résumé. Please try again.");

  if (!claim.resume_id) throw new Error("Server error: No resume ID returned");

  await clearPendingUploadCookie();

  if (!claim.cached) {
    const result = await waitForResumeCompletion(claim.resume_id);

    if (result.status !== "completed") {
      throw new Error(result.error || "Resume parsing failed. Please try again.");
    }
  }

  const siteResponse = await fetchImpl("/api/site-data");

  if (siteResponse.ok) {
    // SAFETY: Site content is schema-validated JSON written by the parse workflow.
    const site = (await siteResponse.json()) as { content?: ResumeContent } | null;

    if (site?.content) {
      return decideWizardStart({
        pendingUpload: null,
        siteContent: site.content,
        latestStatus: null,
      });
    }
  }

  const statusResponse = await fetchImpl("/api/resume/latest-status");

  // SAFETY: This server-controlled endpoint returns a latest-status object or null.
  const latestStatus = statusResponse.ok
    ? ((await statusResponse.json()) as LatestStatus | null)
    : null;

  return decideWizardStart({ pendingUpload: null, siteContent: null, latestStatus });
}
