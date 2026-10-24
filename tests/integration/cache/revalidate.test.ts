import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { logLines } from "@/tests/helpers/log-lines";

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

afterEach(() => {
  revalidatePathMock.mockReset();
  vi.restoreAllMocks();
});

describe("revalidatePublicProfilePages", () => {
  it("flushes the directory, each profile, the galleries and the sitemap", () => {
    revalidatePublicProfilePages(["alice", null, undefined, "bob"]);

    expect(revalidatePathMock.mock.calls).toEqual([
      ["/explore"],
      ["/@alice"],
      ["/@bob"],
      ["/examples/[slug]", "page"],
      ["/sitemap.xml"],
    ]);
  });

  it("logs a failed revalidation instead of failing the write that triggered it", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    revalidatePathMock.mockImplementation(() => {
      throw new Error("no request store");
    });

    expect(() => revalidatePublicProfilePages(["alice"])).not.toThrow();
    expect(logLines(error)[0]).toMatchObject({
      level: "error",
      msg: "Failed to revalidate public profile pages",
    });
  });
});
