import { revalidateTag } from "vinext/shims/cache";

export function invalidateResumeCache(handle: string): Promise<void> {
  if (!handle) return Promise.resolve();
  return revalidateTag(`resume_${handle}`);
}
