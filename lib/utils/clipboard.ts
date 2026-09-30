import { log } from "@/lib/utils/log";

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch (error) {
    log("error", "Failed to copy to clipboard", { error: String(error) });

    return false;
  }
}
