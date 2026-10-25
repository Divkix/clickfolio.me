import type * as TanStackRouter from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import WizardClient from "@/components/wizard/WizardClient";
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
