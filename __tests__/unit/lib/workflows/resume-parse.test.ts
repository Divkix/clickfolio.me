import { describe, expect, it, vi } from "vite-plus/test";
import {
  parseInstanceId,
  startResumeParse,
  type ResumeParseWorkflowBinding,
} from "@/lib/workflows/resume-parse";

const PARAMS = {
  kind: "parse" as const,
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "users/user-1/resume-1/resume.pdf",
  fileHash: "a".repeat(64),
};

function makeBinding(options: { createError?: Error; existing?: boolean }) {
  const create = vi.fn(async ({ id }: { id: string }) => {
    if (options.createError) throw options.createError;

    return { id };
  });

  const get = vi.fn(async (id: string) => {
    if (!options.existing) throw new Error("instance not found");

    return { id };
  });

  // SAFETY: startResumeParse only calls create and get on the binding, implemented above.
  const binding: ResumeParseWorkflowBinding = { create, get } as never;

  return { binding, create, get };
}

describe("parseInstanceId", () => {
  it("uses the resume id for the first run and suffixes manual retries", () => {
    expect(parseInstanceId("resume-1")).toBe("resume-1");
    expect(parseInstanceId("resume-1", 0)).toBe("resume-1");
    expect(parseInstanceId("resume-1", 2)).toBe("resume-1-retry-2");
  });
});

describe("startResumeParse", () => {
  it("creates the instance under the given id", async () => {
    const { binding, create, get } = makeBinding({});

    await startResumeParse(binding, "resume-1", PARAMS);

    expect(create).toHaveBeenCalledWith({ id: "resume-1", params: PARAMS });
    expect(get).not.toHaveBeenCalled();
  });

  it("treats a failed create as success when the instance exists (idempotent id)", async () => {
    const { binding } = makeBinding({ createError: new Error("already exists"), existing: true });

    await expect(startResumeParse(binding, "resume-1", PARAMS)).resolves.toBeUndefined();
  });

  it("rethrows the create error when no instance exists", async () => {
    const createError = new Error("workflows unavailable");
    const { binding } = makeBinding({ createError });

    await expect(startResumeParse(binding, "resume-1", PARAMS)).rejects.toBe(createError);
  });
});
