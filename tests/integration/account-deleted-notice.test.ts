import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { consumeAccountDeletionNotice } from "@/components/home/AccountDeletedNotice";

afterEach(() => vi.unstubAllGlobals());

function browserAt(href: string) {
  const location = { href };
  const state = { key: "landing" };

  const replaceState = vi.fn((_state: typeof state, _title: string, url: URL) => {
    location.href = url.href;
  });

  vi.stubGlobal("window", { location, history: { state, replaceState } });

  return { location, state, replaceState };
}

describe("account deletion receipt", () => {
  it("consumes the client-only receipt once, preserving other URL state", () => {
    const browser = browserAt("https://clickfolio.me/?account_deleted=1&source=settings#main");

    expect(consumeAccountDeletionNotice()).toBe(true);
    expect(browser.location.href).toBe("https://clickfolio.me/?source=settings#main");
    expect(browser.replaceState).toHaveBeenCalledWith(browser.state, "", expect.any(URL));
    expect(consumeAccountDeletionNotice()).toBe(false);
    expect(browser.replaceState).toHaveBeenCalledTimes(1);
  });

  it.each(["https://clickfolio.me/", "https://clickfolio.me/?account_deleted=0"])(
    "does not display a receipt for a normal arrival: %s",
    (href) => {
      const browser = browserAt(href);

      expect(consumeAccountDeletionNotice()).toBe(false);
      expect(browser.replaceState).not.toHaveBeenCalled();
    },
  );
});
