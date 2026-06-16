/**
 * TemplateFontLinks shared component tests
 *
 * Verifies that the shared font-link helper renders the exact three-tag
 * structure every template depends on:
 *   1. <link rel="preconnect" href="https://fonts.googleapis.com">
 *   2. <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous">
 *   3. <link rel="stylesheet" href={the passed href}>
 *
 * Note: React renders <link> elements to document.head in modern React
 * (React 19+), so we query document.head rather than the container.
 */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";

function collectLinks(container: Element) {
  return [
    ...Array.from(container.querySelectorAll("link")),
    ...Array.from(document.head.querySelectorAll("link")),
  ];
}

afterEach(() => {
  // Clean up any link elements added to document.head between tests
  for (const link of Array.from(document.head.querySelectorAll("link"))) {
    link.remove();
  }
});

describe("TemplateFontLinks", () => {
  it("renders exactly 3 link elements (2 preconnects + 1 stylesheet)", () => {
    const href =
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);
    const allLinks = collectLinks(container);
    expect(allLinks).toHaveLength(3);
  });

  it("renders a preconnect to fonts.googleapis.com (no crossOrigin)", () => {
    const href =
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);
    const allLinks = collectLinks(container);
    const googlePreconnect = allLinks.find(
      (l) =>
        l.getAttribute("rel") === "preconnect" &&
        l.getAttribute("href") === "https://fonts.googleapis.com",
    );
    expect(googlePreconnect).toBeDefined();
    expect(googlePreconnect?.getAttribute("crossorigin")).toBeNull();
  });

  it("renders a preconnect to fonts.gstatic.com with crossOrigin=anonymous", () => {
    const href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);
    const allLinks = collectLinks(container);
    const gstaticPreconnect = allLinks.find(
      (l) =>
        l.getAttribute("rel") === "preconnect" &&
        l.getAttribute("href") === "https://fonts.gstatic.com",
    );
    expect(gstaticPreconnect).toBeDefined();
    // crossOrigin="anonymous" serialises to the crossorigin attribute value "anonymous"
    expect(gstaticPreconnect?.getAttribute("crossorigin")).toBe("anonymous");
  });

  it("renders a rel=stylesheet whose href equals the passed href", () => {
    const href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap";
    const { container } = render(<TemplateFontLinks href={href} />);
    const allLinks = collectLinks(container);
    const stylesheetLink = allLinks.find(
      (l) => l.getAttribute("rel") === "stylesheet" && l.getAttribute("href") === href,
    );
    expect(stylesheetLink).toBeDefined();
  });

  it("passes through different font URLs unchanged to the stylesheet link", () => {
    const urls = [
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap",
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
    ];
    for (const href of urls) {
      const { container, unmount } = render(<TemplateFontLinks href={href} />);
      const allLinks = collectLinks(container);
      const stylesheetLink = allLinks.find(
        (l) => l.getAttribute("rel") === "stylesheet" && l.getAttribute("href") === href,
      );
      expect(stylesheetLink).toBeDefined();
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
