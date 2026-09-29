import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { installStaleChunkReload } from "@/lib/utils/chunk-reload";

const reload = vi.fn();

function firePreloadError() {
  const event = new Event("vite:preloadError", { cancelable: true });
  globalThis.dispatchEvent(event);

  return event;
}

describe("installStaleChunkReload", () => {
  beforeAll(() => {
    installStaleChunkReload(reload);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    reload.mockClear();
    globalThis.sessionStorage.clear();
  });

  it("reloads the page when a chunk fails to load", () => {
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again inside the cooldown", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    firePreloadError();
    vi.spyOn(Date, "now").mockReturnValue(1_005_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again after the cooldown ends", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    firePreloadError();
    vi.spyOn(Date, "now").mockReturnValue(1_011_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });

  it("does not cancel the error, so it still reaches error tracking", () => {
    expect(firePreloadError().defaultPrevented).toBe(false);
  });
});
