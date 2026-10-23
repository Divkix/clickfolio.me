import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch (error) {
    log("error", "Failed to copy to clipboard", { ...errorFields(error) });

    return false;
  }
}
