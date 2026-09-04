export const RESUME_MAX_CHARS = 60000;
export const RESUME_HEAD_CHARS = 38000;
export const RESUME_TAIL_CHARS = 18000;
export const RESUME_TRUNCATION_MARKER = "\n\n...[truncated]...\n\n";

export function truncateResumeText(text: string): string {
  if (text.length <= RESUME_MAX_CHARS) return text;
  const head = text.slice(0, RESUME_HEAD_CHARS);
  const tail = text.slice(-RESUME_TAIL_CHARS);
  return `${head}${RESUME_TRUNCATION_MARKER}${tail}`;
}
