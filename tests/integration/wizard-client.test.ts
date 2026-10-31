import type * as TanStackRouter from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import WizardClient, { focusWizardStep } from "@/components/wizard/WizardClient";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { WizardProgress } from "@/components/wizard/WizardProgress";
import { INDEXABLE_CONTENT } from "../helpers/pglite-db";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useNavigate: () => vi.fn(),
}));

describe("wizard initial client render", () => {
  it("opens a returning owner's preloaded content at review without a loading phase", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, {
        initialStart: { kind: "review", content: INDEXABLE_CONTENT },
        ownerHandle: "alice",
      }),
    );

    expect(html).toContain("Review Your Information");
    expect(html).not.toContain("Choose Your Handle");
    expect(html).not.toContain("Loading your resume");
  });

  it("asks an owner without a handle to choose one before review", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, {
        initialStart: { kind: "review", content: INDEXABLE_CONTENT },
        ownerHandle: null,
      }),
    );

    expect(html).toContain("Choose Your Handle");
    expect(html).not.toContain("Loading your resume");
  });

  it("renders upload immediately when no resume exists", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, { initialStart: { kind: "upload" }, ownerHandle: null }),
    );

    expect(html).toContain("Upload Your Resume");
    expect(html).not.toContain("Loading your resume");
  });

  it("keeps the loading screen until a pending upload has been claimed", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, {
        initialStart: {
          kind: "claim-first",
          pendingUpload: { key: "temp/new-resume.pdf", file_hash: null },
        },
        ownerHandle: "alice",
      }),
    );

    expect(html).toContain("Loading your resume");
    expect(html).not.toContain("Choose Your Handle");
  });
});

describe("wizard step entry", () => {
  it("focuses the heading without scrolling it under the sticky bar, then scrolls the step", () => {
    const heading = { tabIndex: 0, focus: vi.fn() };
    const scrollIntoView = vi.fn();
    const content = { querySelector: vi.fn(() => heading), scrollIntoView };

    focusWizardStep(content);

    expect(content.querySelector).toHaveBeenCalledWith("h1");
    expect(heading.tabIndex).toBe(-1);
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    expect(heading.focus.mock.invocationCallOrder[0]).toBeLessThan(
      scrollIntoView.mock.invocationCallOrder[0]!,
    );
  });
});

describe("wizard publishing step", () => {
  it("offers publishing with the selected template and explains public access", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeStep, {
        handle: "lucia-fernandez-garcia",
        initialTheme: "bento",
        onContinue: vi.fn(),
      }),
    );

    expect(html).toContain("Selected template:");
    expect(html).toContain("Bento Grid");
    expect(html).toContain("Publish my page");
    expect(html).toContain("clickfolio.me/@lucia-fernandez-garcia");
    expect(html).toContain("Anyone with the link can view it.");
    expect(html).toContain("template, content and privacy");
    expect(html).not.toContain("Complete Setup");
  });

  it.each([false, true])("names the final step a template with upload step %s", (hasUploadStep) => {
    const totalSteps = hasUploadStep ? 5 : 4;

    const html = renderToStaticMarkup(
      createElement(WizardProgress, {
        currentStep: totalSteps,
        totalSteps,
        progress: 100,
        hasUploadStep,
      }),
    );

    expect(html).toContain("Select Template");
    expect(html).not.toContain("Select Theme");
  });
});
