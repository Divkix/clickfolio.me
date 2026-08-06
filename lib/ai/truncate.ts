/**
 * Resume-text truncation shared by the initial parse (`lib/ai/index.ts`) and the
 * error-feedback retry path (`lib/ai/ai-parser.ts`). Both must re-prompt the
 * model with the SAME slice of resume text, so the limits live in one place —
 * a future change can't silently desync the two prompt sizes.
 */

/** Total character budget for the resume text sent to the AI. */
export const RESUME_MAX_CHARS = 60000;
/** Characters kept from the start of the resume (header + recent sections). */
export const RESUME_HEAD_CHARS = 38000;
/** Characters kept from the end of the resume. */
export const RESUME_TAIL_CHARS = 18000;
/** Marker inserted between the head and tail slices. */
export const RESUME_TRUNCATION_MARKER = "\n\n...[truncated]...\n\n";

/**
 * Truncate resume text to fit within the AI context budget.
 * Keeps the first {@link RESUME_HEAD_CHARS} and last {@link RESUME_TAIL_CHARS}
 * characters, dropping the middle via {@link RESUME_TRUNCATION_MARKER}.
 */
export function truncateResumeText(text: string): string {
  if (text.length <= RESUME_MAX_CHARS) return text;
  const head = text.slice(0, RESUME_HEAD_CHARS);
  const tail = text.slice(-RESUME_TAIL_CHARS);
  return `${head}${RESUME_TRUNCATION_MARKER}${tail}`;
}
