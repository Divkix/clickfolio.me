import { afterEach, vi } from "vite-plus/test";

export function setupMockCleanup() {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
}

export function suppressConsole(method: "error" | "warn" | "log" | "info" | "debug" = "error") {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  return spy;
}
