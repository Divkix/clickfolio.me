import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Breadcrumb } from "@/components/ui/breadcrumb";

describe("Breadcrumb", () => {
  it("emits BreadcrumbList JSON-LD that matches the visible crumbs", () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Explore Professionals", href: "/explore" },
        ]}
      />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script?.textContent ?? "{}") as {
      "@type": string;
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toEqual([
      expect.objectContaining({ name: "Home", item: "https://clickfolio.me" }),
      expect.objectContaining({
        name: "Explore Professionals",
        item: "https://clickfolio.me/explore",
      }),
    ]);
    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe("Breadcrumb");
  });

  it("skips JSON-LD when includeJsonLd is false", () => {
    const { container } = render(
      <Breadcrumb
        includeJsonLd={false}
        items={[
          { label: "Home", href: "/" },
          { label: "Explore", href: "/explore" },
        ]}
      />,
    );

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
