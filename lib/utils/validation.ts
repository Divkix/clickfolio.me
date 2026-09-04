const DEFAULT_MAX_FILE_SIZE_MB = 5;

const effectiveMaxFileSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB) || DEFAULT_MAX_FILE_SIZE_MB;

export const MAX_FILE_SIZE = effectiveMaxFileSizeMb * 1024 * 1024;

export const MAX_FILE_SIZE_LABEL = `${effectiveMaxFileSizeMb}MB`;

export type ValidationResult = { valid: boolean; error?: string };

export function validatePDF(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE_LABEL}` };
  }
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed" };
  }
  return { valid: true };
}

function sanitizeFilename(filename: string): string {
  let safe = filename.replace(/\.\./g, "");
  safe = safe.replace(/[/\\]/g, "");
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");
  safe = safe.slice(0, 255);
  if (!safe || safe.length === 0) {
    safe = "resume.pdf";
  }
  if (!safe.endsWith(".pdf")) {
    safe = `${safe}.pdf`;
  }
  return safe;
}

export function generateTempKey(filename: string): string {
  const uuid = crypto.randomUUID();
  const safeFilename = sanitizeFilename(filename);
  return `temp/${uuid}/${safeFilename}`;
}

export function validatePDFBuffer(buffer: ArrayBuffer): ValidationResult {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    error: "File is not a valid PDF (invalid magic number)",
  };
}

export function validateRequestSize(
  request: Request,
  maxSizeBytes: number = 5_000_000,
): ValidationResult {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    return { valid: true };
  }

  const size = parseInt(contentLength, 10);

  if (Number.isNaN(size)) {
    return { valid: false, error: "Invalid content-length header" };
  }

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Request body too large (${(size / 1_000_000).toFixed(1)}MB). Maximum size is ${(maxSizeBytes / 1_000_000).toFixed(1)}MB.`,
    };
  }

  return { valid: true };
}

export async function readJsonWithLimit(
  request: Request,
  maxSizeBytes: number = 5_000_000,
): Promise<
  { ok: true; data: unknown } | { ok: false; reason: "too_large" | "invalid_json"; error: string }
> {
  if (!request.body) {
    return { ok: true, data: undefined };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxSizeBytes) {
        await reader.cancel();
        return {
          ok: false,
          reason: "too_large",
          error: `Request body too large. Maximum size is ${(maxSizeBytes / 1_000_000).toFixed(1)}MB.`,
        };
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, reason: "invalid_json", error: "Invalid JSON in request body" };
  }
}
