import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({
  router: {
    refresh: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
  Toaster: () => null,
}));

vi.mock("@/lib/templates/theme-registry.client", () => {
  const themeIds = [
    "bento",
    "bold_corporate",
    "classic_ats",
    "design_folio",
    "dev_terminal",
    "glass",
    "midnight",
    "minimalist_editorial",
    "neo_brutalist",
    "spotlight",
  ];
  return {
    DYNAMIC_TEMPLATES: Object.fromEntries(
      themeIds.map((id) => [
        id,
        ({ content }: { content: { full_name?: string } }) => (
          <div data-testid="theme-preview">
            {id}:{content.full_name}
          </div>
        ),
      ]),
    ),
  };
});

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Product Engineer",
  summary: "Builds reliable products.",
  contact: { email: "avery@example.com" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

describe("PrivacySettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () =>
      Response.json({ success: true }),
    ) as unknown as typeof fetch;
  });

  it("saves each privacy toggle and updates visible status labels", async () => {
    const user = userEvent.setup();
    render(
      <PrivacySettingsForm
        userHandle="avery"
        initialSettings={{
          show_phone: false,
          show_address: false,
          hide_from_search: false,
          show_in_directory: false,
        }}
      />,
    );

    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);
    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith("Privacy settings updated"),
    );
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "/api/profile/privacy",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          show_phone: true,
          show_address: false,
          hide_from_search: false,
          show_in_directory: false,
        }),
      }),
    );
    expect(screen.getAllByText("Visible").length).toBeGreaterThan(0);

    await user.click(switches[1]);
    await user.click(switches[2]);
    await user.click(switches[3]);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(4));
    expect(screen.getAllByText("Full address").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Listed").length).toBeGreaterThan(0);
  });

  it("surfaces API and thrown privacy update failures", async () => {
    const user = userEvent.setup();
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(Response.json({ message: "Privacy rejected" }, { status: 400 }))
      .mockRejectedValueOnce("network");

    render(
      <PrivacySettingsForm
        userHandle={null}
        initialSettings={{
          show_phone: true,
          show_address: true,
          hide_from_search: true,
          show_in_directory: true,
        }}
      />,
    );

    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Privacy rejected"));

    await user.click(switches[1]);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to update privacy settings"),
    );
  });
});

describe("ThemeSelector", () => {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () =>
      Response.json({ success: true }),
    ) as unknown as typeof fetch;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 640,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalOffsetWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    }
  });

  it("prevents locked click selection and applies an unlocked theme", async () => {
    render(
      <ThemeSelector
        initialThemeId="bento"
        initialContent={resumeContent}
        profile={{ handle: "avery", avatar_url: null }}
        referralCount={0}
        isPro={false}
      />,
    );

    expect(screen.getAllByText("Bento Grid").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("option", { name: /DesignFolio/ }));
    expect(screen.queryByRole("button", { name: "Apply Theme" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /Classic ATS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Theme" }));

    await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalled());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/resume/update-theme",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ theme_id: "classic_ats" }),
      }),
    );
    expect(screen.getByText("Theme updated to Classic ATS")).toBeInTheDocument();

    fireEvent(window, new Event("resize"));
  });

  it("supports keyboard selection, pro locked-theme access, resize scaling, and API errors", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      Response.json({ error: "Theme update failed" }, { status: 500 }),
    );
    render(
      <ThemeSelector
        initialThemeId="bento"
        initialContent={resumeContent}
        profile={{ handle: "avery", avatar_url: null }}
        referralCount={0}
        isPro={true}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: "Theme selection" });
    fireEvent.keyDown(listbox, { key: "ArrowRight" });
    expect(screen.getAllByText("Bold Corporate").length).toBeGreaterThan(0);
    fireEvent.keyDown(listbox, { key: "ArrowLeft" });
    expect(screen.getAllByText("Bento Grid").length).toBeGreaterThan(0);
    fireEvent(window, new Event("resize"));

    fireEvent.click(screen.getByRole("option", { name: /Bold Corporate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Theme" }));

    expect(await screen.findByText("Theme update failed")).toBeInTheDocument();
  });
});
