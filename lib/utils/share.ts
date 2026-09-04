export function generateTwitterShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text,
    url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function generateLinkedInShareUrl(url: string): string {
  const params = new URLSearchParams({
    url,
  });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}

export function generateWhatsAppShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text: `${text} ${url}`,
  });
  return `https://wa.me/?${params.toString()}`;
}

export function generateShareText(name: string, handle?: string): string {
  const displayName = name || handle || "someone";
  return `Check out ${displayName}'s portfolio`;
}

export function isWebShareSupported(): boolean {
  return (
    globalThis.navigator !== undefined &&
    globalThis.navigator.share instanceof Function &&
    globalThis.navigator.canShare instanceof Function
  );
}

export async function webShare(data: { title: string; text: string; url: string }): Promise<void> {
  if (!isWebShareSupported()) {
    throw new Error("Web Share API not supported");
  }
  await navigator.share(data);
}
