import type { ResumeParseMessage } from "./types";

/**
 * Publish a resume parse job to the queue
 */
export async function publishResumeParse(
  queue: Queue<ResumeParseMessage>,
  params: {
    resumeId: string;
    userId: string;
    r2Key: string;
    fileHash: string;
    attempt?: number;
  },
): Promise<void> {
  const message: ResumeParseMessage = {
    type: "parse",
    resumeId: params.resumeId,
    userId: params.userId,
    r2Key: params.r2Key,
    fileHash: params.fileHash,
    attempt: params.attempt ?? 1,
  };

  await queue.send(message);
}
