import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";

export async function clearPendingUploadCookie(): Promise<void> {
  try {
    await fetch("/api/upload/pending", { method: "DELETE" });
  } catch (error) {
    log("warn", "Failed to clear pending upload cookie", { ...errorFields(error) });
  }
}
