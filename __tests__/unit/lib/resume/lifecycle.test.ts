import { describe, expect, it } from "vite-plus/test";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { canRetryResume } from "@/lib/resume/lifecycle";

describe("canRetryResume", () => {
  type Base = {
    status: ResumeStatus;
    retryCount: number;
    totalAttempts: number;
    lastAttemptErrorType: string | null;
  };
  const base = {
    status: "failed",
    retryCount: 0,
    totalAttempts: 1,
    lastAttemptErrorType: null as string | null,
  } satisfies Base;

  const cases: Array<{
    name: string;
    input: Parameters<typeof canRetryResume>[0];
    expected: boolean;
  }> = [
    {
      name: "status is not failed → false",
      input: { ...base, status: "processing" } as Base,
      expected: false,
    },
    {
      name: "total attempts at the cap (6) → false",
      input: { ...base, totalAttempts: 6 },
      expected: false,
    },
    {
      name: "manual retry count at the cap (2) → false",
      input: { ...base, retryCount: 2 },
      expected: false,
    },
    {
      name: "permanent error type (invalid_pdf) → false",
      input: { ...base, lastAttemptErrorType: "invalid_pdf" },
      expected: false,
    },
    {
      name: "happy path: failed, low counts, no error → true",
      input: { ...base },
      expected: true,
    },
    {
      name: "happy path: failed, low counts, transient error → true",
      input: { ...base, lastAttemptErrorType: "db_connection_error" },
      expected: true,
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(canRetryResume(input)).toBe(expected);
    });
  }
});
