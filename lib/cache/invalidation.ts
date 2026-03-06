import { revalidatePath, revalidateTag } from "vinext/shims/cache";

export async function invalidateResumeCache(handle: string): Promise<void> {
  if (!handle) return;
  await revalidateTag(`resume_${handle}`);
  revalidatePath(`/@${handle}`);
}
