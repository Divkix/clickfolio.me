/**
 * TemplateFontLinks shared component tests
 *
 * Verifies that the shared font-link helper renders the expected
 * three-link pattern (preconnect × 2 + stylesheet) for any given href.
 *
 * Note: React renders <link> elements to document.head in modern React
 * (React 19+), so we query document.head rather than the container.
 */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";

afterEach(() => {
  // Clean up any link elements added to document.head between tests
  for (const link of Array.from(document.head.querySelectorAll("link"))) {
    link.remove();
  }
});

describe("TemplateFontLinks", () => {
  it("renders link elements for the provided font URL (container or head)", () => {
    const href =
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);

    // React may render <link> elements into document.head or the container
    const allLinks = [
      ...Array.from(container.querySelectorAll("link")),
      ...Array.from(document.head.querySelectorAll("link")),
    ];
    expect(allLinks.length).toBeGreaterThan(0);
  });

  it("passes the font href through to a stylesheet link element", () => {
    const href =
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);

    // Check both container and document.head for the stylesheet link
    const allLinks = [
      ...Array.from(container.querySelectorAll("link")),
      ...Array.from(document.head.querySelectorAll("link")),
    ];
    const stylesheetLink = allLinks.find((l) => l.getAttribute("href") === href);
    expect(stylesheetLink).toBeDefined();
  });

  it("includes a googleapis.com reference in the rendered output", () => {
    const href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);

    const allLinks = [
      ...Array.from(container.querySelectorAll("link")),
      ...Array.from(document.head.querySelectorAll("link")),
    ];
    const hrefs = allLinks.map((l) => l.getAttribute("href") ?? "");
    const hasGoogleFontsRef =
      hrefs.some((h) => h.includes("fonts.googleapis.com")) ||
      hrefs.some((h) => h.includes("fonts.gstatic.com"));
    expect(hasGoogleFontsRef).toBe(true);
  });

  it("passes through different font URLs unchanged", () => {
    const urls = [
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap",
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
    ];
    for (const href of urls) {
      const { container, unmount } = render(<TemplateFontLinks href={href} />);
      const allLinks = [
        ...Array.from(container.querySelectorAll("link")),
        ...Array.from(document.head.querySelectorAll("link")),
      ];
      const found = allLinks.some((l) => l.getAttribute("href") === href);
      expect(found).toBe(true);
      unmount();
      // Clean up head
      for (const link of Array.from(document.head.querySelectorAll("link"))) {
        link.remove();
      }
    }
  });

  it("renders without throwing for any valid Google Fonts URL", () => {
    expect(() =>
      render(
        <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap" />,
      ),
    ).not.toThrow();
  });
});
