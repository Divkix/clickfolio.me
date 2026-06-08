import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { SharePopover, type SharePopoverVariant } from "@/components/SharePopover";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    refresh: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  signOut: vi.fn(async (options?: { fetchOptions?: { onSuccess?: () => void } }) => {
    options?.fetchOptions?.onSuccess?.();
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/auth/client", () => ({
  signOut: (options?: { fetchOptions?: { onSuccess?: () => void } }) => mocks.signOut(options),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
  Toaster: () => null,
}));

const origClipboard = navigator.clipboard;
const origShare = navigator.share;
const origCanShare = navigator.canShare;
const origWindowOpen = window.open;

function installShareMocks() {
  const writeText = vi.fn(async () => undefined);
  const share = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
  Object.defineProperty(navigator, "canShare", {
    value: vi.fn(() => true),
    configurable: true,
  });
  window.open = vi.fn();
  return { share, writeText };
}

describe("SharePopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installShareMocks();
  });

  afterEach(() => {
    if (origClipboard !== undefined) {
      Object.defineProperty(navigator, "clipboard", { value: origClipboard, configurable: true });
    } else {
      delete (navigator as { clipboard?: typeof navigator.clipboard }).clipboard;
    }
    if (origShare !== undefined) {
      Object.defineProperty(navigator, "share", { value: origShare, configurable: true });
    } else {
      delete (navigator as { share?: typeof navigator.share }).share;
    }
    if (origCanShare !== undefined) {
      Object.defineProperty(navigator, "canShare", { value: origCanShare, configurable: true });
    } else {
      delete (navigator as { canShare?: typeof navigator.canShare }).canShare;
    }
    if (origWindowOpen !== undefined) {
      window.open = origWindowOpen;
    } else {
      delete (window as { open?: typeof window.open }).open;
    }
  });

  it("supports native sharing, social share URLs, copy, Escape, and outside close", async () => {
    const user = userEvent.setup();
    const { share, writeText } = installShareMocks();
    render(
      <SharePopover
        url="https://clickfolio.me/@avery"
        title="Avery Portfolio"
        name="Avery Quinn"
        variant="dev-terminal"
      />,
    );

    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: "Share this page" }));
    expect(share).toHaveBeenCalledWith({
      title: "Avery Portfolio",
      text: "Check out Avery Quinn's portfolio",
      url: "https://clickfolio.me/@avery",
    });
    expect(screen.queryByRole("dialog", { name: "Share options" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: "Share on X (Twitter)" }));
    expect(window.open).toHaveBeenLastCalledWith(
      expect.stringContaining("https://twitter.com/intent/tweet?"),
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: "Share on LinkedIn" }));
    expect(window.open).toHaveBeenLastCalledWith(
      expect.stringContaining("https://www.linkedin.com/sharing/share-offsite/"),
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: "Share on WhatsApp" }));
    expect(window.open).toHaveBeenLastCalledWith(
      expect.stringContaining("https://wa.me/?"),
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("https://clickfolio.me/@avery");
    expect(mocks.toast.success).toHaveBeenCalledWith("Link copied!");

    await user.click(screen.getByRole("button", { name: /share/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Share options" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /share/i }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Share options" })).not.toBeInTheDocument();
  });

  it("uses handle-based URLs, hides native share when unsupported, and ignores share cancelation", async () => {
    const user = userEvent.setup();
    const { writeText } = installShareMocks();
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      configurable: true,
    });
    render(<SharePopover handle="avery" title="Avery" name="" variant="midnight" />);

    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.queryByRole("button", { name: "Share this page" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/@avery");

    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn(() => true),
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: vi.fn(async () => {
        throw abortError;
      }),
      configurable: true,
    });
    render(<SharePopover handle="cancelled" title="Cancel" name="Cancel User" />);
    await user.click(screen.getAllByRole("button", { name: /share/i }).at(-1) ?? document.body);
    await user.click(screen.getByRole("button", { name: "Share this page" }));
    expect(navigator.share).toHaveBeenCalled();
  });

  it("renders theme variants without dropping share actions", async () => {
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      configurable: true,
    });
    const variants: SharePopoverVariant[] = [
      "minimalist-editorial",
      "neo-brutalist",
      "glass-morphic",
      "bento-grid",
      "spotlight",
      "midnight",
      "bold-corporate",
      "classic-ats",
      "design-folio",
      "dev-terminal",
    ];

    for (const variant of variants) {
      const { unmount } = render(
        <SharePopover
          url={`https://clickfolio.me/${variant}`}
          title={variant}
          name={variant}
          variant={variant}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /share/i }));
      expect(screen.getByRole("button", { name: "Share on LinkedIn" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("DeleteAccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("requires an email match, deletes the account, surfaces warnings, and signs out", async () => {
    const user = userEvent.setup();
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      Response.json({
        success: true,
        warnings: [{ type: "r2", message: "Failed to delete file: old.pdf" }],
      }),
    );

    render(<DeleteAccountCard userEmail="avery@example.com" />);
    await user.click(screen.getByRole("button", { name: "Delete Account" }));

    const deleteForever = screen.getByRole("button", { name: /delete forever/i });
    expect(deleteForever).toBeDisabled();
    await user.type(screen.getByLabelText(/Type/), "AVERY@EXAMPLE.COM");
    expect(deleteForever).toBeEnabled();
    await user.click(deleteForever);

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/account/delete",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ confirmation: "AVERY@EXAMPLE.COM" }),
      }),
    );
    expect(mocks.toast.warning).toHaveBeenCalledWith("Warning: Failed to delete file: old.pdf");
    expect(mocks.toast.success).toHaveBeenCalledWith("Your account has been deleted");
    expect(mocks.router.push).toHaveBeenCalledWith("/");
    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it("shows API errors, clears state on cancel, and handles network failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(
          Response.json({ error: "Email confirmation mismatch" }, { status: 400 }),
        )
        .mockRejectedValueOnce(new Error("network down"));

      render(<DeleteAccountCard userEmail="avery@example.com" />);
      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      await user.type(screen.getByLabelText(/Type/), "avery@example.com");
      await user.click(screen.getByRole("button", { name: /delete forever/i }));

      expect(await screen.findByText("Email confirmation mismatch")).toBeInTheDocument();
      expect(mocks.toast.error).toHaveBeenCalledWith("Email confirmation mismatch");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      expect(screen.getByLabelText(/Type/)).toHaveValue("");

      await user.type(screen.getByLabelText(/Type/), "avery@example.com");
      await user.click(screen.getByRole("button", { name: /delete forever/i }));
      expect(
        await screen.findByText("An unexpected error occurred. Please try again."),
      ).toBeInTheDocument();
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "An unexpected error occurred. Please try again.",
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
