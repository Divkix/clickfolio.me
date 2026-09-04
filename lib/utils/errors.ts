import { toast } from "sonner";
import { MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";

type ErrorCategory = "transient" | "fatal" | "auth" | "validation" | "rate_limit";

export function classifyError(status: number): ErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "fatal";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limit";
  if (status >= 500 || status === 0) return "transient";
  return "fatal";
}

export function getErrorMessage(status: number, context?: string): string {
  const messages = {
    0: "Network error. Check your connection.",
    401: "Session expired. Please sign in again.",
    403: "You don't have permission for this action.",
    404: "Resource not found.",
    413: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`,
    422: "Invalid data. Please check your input.",
    429: "Too many requests. Please wait before trying again.",
    500: "Server error. We're working on it.",
    502: "Server temporarily unavailable. Please try again.",
    503: "Service unavailable. Please try again later.",
    504: "Request timed out. Please try again.",
  } as const satisfies Record<number, string>;
  // SAFETY: status is number from HTTP, cast to known message key union; fallback handles unknown codes.
  return (
    messages[status as keyof typeof messages] ||
    `Something went wrong${context ? ` with ${context}` : ""}.`
  );
}

export function showErrorToast(status: number, context?: string) {
  const category = classifyError(status);
  const message = getErrorMessage(status, context);

  if (category === "auth") {
    toast.error(message, {
      action: {
        label: "Sign In",
        onClick: () => {
          window.location.href = "/";
        },
      },
    });
  } else if (category === "rate_limit") {
    toast.error(message, { duration: 10000 });
  } else {
    toast.error(message);
  }
}
