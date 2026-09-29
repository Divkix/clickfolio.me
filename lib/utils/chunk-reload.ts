const RELOAD_AT_KEY = "clickfolio:stale-chunk-reload-at";

const RELOAD_COOLDOWN_MS = 10_000;

/**
 * A deploy deletes the previous build's hashed chunks, but an ISR-cached page
 * can still reference them, so a client component's `import()` fails. Vite
 * dispatches `vite:preloadError` for that failure; reload to get current HTML.
 * The sessionStorage cooldown stops a reload loop when a reload does not fix it.
 */
export function installStaleChunkReload(reload = () => globalThis.location.reload()): void {
  globalThis.addEventListener("vite:preloadError", () => {
    const now = Date.now();

    try {
      const lastReloadAt = Number(globalThis.sessionStorage.getItem(RELOAD_AT_KEY));

      if (now - lastReloadAt < RELOAD_COOLDOWN_MS) return;

      globalThis.sessionStorage.setItem(RELOAD_AT_KEY, String(now));
    } catch {
      // No storage means no loop guard, so let the error surface instead.
      return;
    }

    reload();
  });
}
