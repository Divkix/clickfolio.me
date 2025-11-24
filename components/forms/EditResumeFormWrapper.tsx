"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ResumeContent } from "@/lib/types/database";
import { EditResumeForm } from "./EditResumeForm";

interface EditResumeFormWrapperProps {
  initialData: ResumeContent;
}

export function EditResumeFormWrapper({ initialData }: EditResumeFormWrapperProps) {
  const router = useRouter();

  const handleSave = async (data: ResumeContent) => {
    const response = await fetch("/api/resume/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: data }),
    });

    if (!response.ok) {
      const error = await response.json();
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

    const result = await response.json();

    // Refresh the page to get updated data
    router.refresh();

    return result;
  };

  return <EditResumeForm initialData={initialData} onSave={handleSave} />;
}
