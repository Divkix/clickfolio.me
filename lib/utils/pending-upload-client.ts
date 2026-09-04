export async function setPendingUploadCookie(key: string): Promise<void> {
  const response = await fetch("/api/upload/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!response.ok) {
    throw new Error("Failed to save pending upload");
  }
}

export async function clearPendingUploadCookie(): Promise<void> {
  try {
    await fetch("/api/upload/pending", { method: "DELETE" });
  } catch (error) {
    console.warn("Failed to clear pending upload cookie:", error);
  }
}
