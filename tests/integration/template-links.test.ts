import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ExternalLink, LINK_REL, MaybeLink } from "@/components/templates/shared/ExternalLink";

describe("template external links", () => {
  it("preserves anchor attributes and escaped children", () => {
    const props = {
      href: "https://example.com/project",
      className: "theme-link",
      title: "Project",
    };

    const children = "Project <name>";

    expect(renderToStaticMarkup(createElement(ExternalLink, props, children))).toBe(
      renderToStaticMarkup(
        createElement("a", { ...props, target: "_blank", rel: LINK_REL }, children),
      ),
    );

    const { href, ...attributes } = props;

    expect(renderToStaticMarkup(createElement(MaybeLink, props, children))).toBe(
      renderToStaticMarkup(createElement(ExternalLink, { ...attributes, href }, children)),
    );
  });

  it.each([undefined, null, ""])("renders bare children without an href (%s)", (href) => {
    expect(
      renderToStaticMarkup(createElement(MaybeLink, { href, className: "theme-link" }, "Name")),
    ).toBe("Name");
  });
});
