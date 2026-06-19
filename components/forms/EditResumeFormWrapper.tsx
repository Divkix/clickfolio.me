"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ApiErrorBody } from "@/lib/types/api";
import type { ResumeContent } from "@/lib/types/database";
import { EditResumeForm } from "./EditResumeForm";

interface EditResumeFormWrapperProps {
  initialData: ResumeContent;
}

export function EditResumeFormWrapper({ initialData }: EditResumeFormWrapperProps) {
  const router = useRouter();

  const handleSave = async (data: ResumeContent, isAutoSave?: boolean): Promise<void> => {
    const response = await fetch("/api/resume/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: data }),
    });

    if (!response.ok) {
      const error = (await response.json()) as ApiErrorBody;
      const errorMessage = error.error || "Failed to update resume";

      // Display specific error messages to user
      if (response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
      } else if (response.status === 401) {
        toast.error("Session expired. Please log in again.");
      } else {
        toast.error(errorMessage);
      }

      throw new Error(errorMessage);
    }

    await response.json();

    // Only refresh on explicit "Publish Changes" (manual submit), not autosave.
    // Autosave already persists data to D1 — the RSC re-render + D1 read from
    // router.refresh() is unnecessary overhead for background saves.
    if (!isAutoSave) {
      router.refresh();
    }
  };

  return <EditResumeForm initialData={initialData} onSave={handleSave} />;
}
