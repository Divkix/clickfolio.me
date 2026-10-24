import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import WizardClient from "@/components/wizard/WizardClient";
import { INDEXABLE_CONTENT } from "../helpers/pglite-db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("wizard initial client render", () => {
  it("renders the existing handle-first flow immediately when content is preloaded", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, {
        initialStart: { kind: "review", content: INDEXABLE_CONTENT },
      }),
    );

    expect(html).toContain("Choose Your Handle");
    expect(html).not.toContain("Loading your resume");
  });

  it("renders upload immediately when no resume exists", () => {
    const html = renderToStaticMarkup(
      createElement(WizardClient, { initialStart: { kind: "upload" } }),
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
      }),
    );

    expect(html).toContain("Loading your resume");
    expect(html).not.toContain("Choose Your Handle");
  });
});
