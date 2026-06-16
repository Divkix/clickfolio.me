/**
 * getContactIcon shared renderer tests
 *
 * Verifies that the shared icon function returns the expected icon element
 * for each ContactLinkType, with the correct props (className, size, variant).
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { getContactIcon } from "@/components/templates/shared/ContactIcon";

describe("getContactIcon", () => {
  describe("returns a non-null ReactNode for standard types", () => {
    const standardTypes = ["email", "phone", "location", "website", "github", "linkedin"] as const;

    for (const type of standardTypes) {
      it(`returns a ReactNode for type="${type}"`, () => {
        const node = getContactIcon(type, { className: "w-4 h-4" });
        expect(node).not.toBeNull();
      });
    }
  });

  describe("returns null for behance / dribbble (no standard icon)", () => {
    it('returns null for type="behance"', () => {
      expect(getContactIcon("behance")).toBeNull();
    });

    it('returns null for type="dribbble"', () => {
      expect(getContactIcon("dribbble")).toBeNull();
    });
  });

  describe("className prop is forwarded", () => {
    it("forwards className to the lucide icon", () => {
      const node = getContactIcon("email", { className: "w-5 h-5 text-red-500" });
      const { container } = render(<>{node}</>);
      const el = container.firstElementChild;
      expect(el?.getAttribute("class")).toContain("w-5");
      expect(el?.getAttribute("class")).toContain("h-5");
    });

    it("forwards className to the brand icon (img wrapper)", () => {
      const node = getContactIcon("github", { className: "w-4 h-4" });
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("class")).toContain("w-4");
      expect(img?.getAttribute("class")).toContain("h-4");
    });
  });

  describe("size prop is forwarded", () => {
    it("forwards size to the lucide icon (renders an svg)", () => {
      const node = getContactIcon("email", { size: 18 });
      const { container } = render(<>{node}</>);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
    });

    it("forwards size to the brand icon (img width/height attribute)", () => {
      const node = getContactIcon("github", { size: 20 });
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("width")).toBe("20");
      expect(img?.getAttribute("height")).toBe("20");
    });
  });

  describe("variant prop selects the correct brand icon asset", () => {
    it("uses the black variant (default) for github", () => {
      const node = getContactIcon("github");
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toContain("black");
    });

    it('uses the white variant when variant="white" for github', () => {
      const node = getContactIcon("github", { variant: "white" });
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toContain("white");
    });

    it("uses the black variant (default) for linkedin", () => {
      const node = getContactIcon("linkedin");
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toContain("black");
    });

    it('uses the white variant when variant="white" for linkedin', () => {
      const node = getContactIcon("linkedin", { variant: "white" });
      const { container } = render(<>{node}</>);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toContain("white");
    });
  });

  describe("renders without throwing for all ContactLinkTypes", () => {
    const allTypes = [
      "email",
      "phone",
      "location",
      "linkedin",
      "github",
      "website",
      "behance",
      "dribbble",
    ] as const;

    for (const type of allTypes) {
      it(`does not throw for type="${type}"`, () => {
        expect(() => {
          const node = getContactIcon(type, { className: "w-4 h-4", "aria-hidden": true });
          render(<>{node}</>);
        }).not.toThrow();
      });
    }
  });
});
