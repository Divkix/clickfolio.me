import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import PreviewPage from "@/app/preview/[id]/page";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("/preview/[id]", () => {
  it.each(["toString", "constructor", "__proto__", "not-a-theme"])(
    "404s invalid theme %s before reading demo data",
    async (id) => {
      await expect(PreviewPage({ params: Promise.resolve({ id }) })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    },
  );

  it("renders a current theme", async () => {
    const page = await PreviewPage({ params: Promise.resolve({ id: "boardroom" }) });
    expect(renderToStaticMarkup(page)).toContain(DEMO_RESUME_CONTENT.boardroom.full_name);
  });
});
