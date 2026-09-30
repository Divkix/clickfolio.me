import { render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import TemplatesShowcasePage from "@/app/blog/clickfolio-templates-showcase/page";
import LinkedInToPortfolioPage from "@/app/blog/linkedin-to-portfolio/page";
import BlogPage from "@/app/blog/page";
import Home from "@/app/page";
import { getPostBySlug } from "@/lib/blog/posts";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
};

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams("ref=ABCD1234"),
}));

vi.mock("@/lib/auth/client", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(() => ({ isSignedIn: false, sessionId: null })),
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: vi.fn(() => ({ isLoaded: true, user: null })),
  useSession: () => ({ data: null, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("public page rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = "";
      readonly scrollMargin = "";
      readonly thresholds = [];
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
      disconnect() {}
    };

    Object.defineProperty(navigator, "sendBeacon", {
      value: vi.fn(),
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn(() => ({ matches: false })),
      configurable: true,
    });
  });

  it("renders the homepage with its upload CTA and discovery content", () => {
    const { container, getByRole, getByLabelText } = render(<Home />);
    const h1 = container.querySelector("h1");

    expect(h1?.textContent).toBe("Your résumé, live on the web in 30 seconds.");
    expect(getByRole("button", { name: "Upload your résumé" })).toBeInTheDocument();
    expect(getByLabelText("Try your handle")).toBeInTheDocument();
    expect(container.querySelector("#upload-card")).not.toBeNull();
    expect(container.textContent).toContain("Open source");
    expect(getByRole("link", { name: "Browse real portfolios" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Read our guides" })).toBeInTheDocument();
  });

  it("renders a specific blog listing H1, not a generic Blog label", () => {
    const { container } = render(<BlogPage />);
    const h1 = container.querySelector("h1");

    expect(h1?.textContent).toMatch(/resume website/i);
    expect(h1?.textContent?.trim()).not.toBe("Blog");
  });

  it("offers a LinkedIn PDF upload CTA right after Method 1", () => {
    const { getByRole } = render(<LinkedInToPortfolioPage />);
    const cta = getByRole("link", { name: "Upload my LinkedIn PDF export" });

    const method1 = getByRole("heading", {
      name: "Method 1: Export LinkedIn as PDF, Upload to clickfolio.me",
    });

    const method2 = getByRole("heading", { name: "Method 2: Use Your Resume PDF" });

    expect(cta).toHaveAttribute(
      "href",
      "/?utm_source=blog&utm_medium=organic&utm_campaign=linkedin-to-portfolio#upload-card",
    );
    expect(cta.compareDocumentPosition(method1) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(cta.compareDocumentPosition(method2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("uses the registry count for every template quantity in the showcase", () => {
    const count = Object.keys(THEME_METADATA).length;
    const { container } = render(<TemplatesShowcasePage />);

    expect(container.textContent).toContain(count + " distinct templates");
    expect(container.textContent).toContain("All " + count + " templates are free");
    expect(container.textContent).toContain("try all " + count + " templates");
  });

  it("glues byline separators to their labels and preserves the datetime", () => {
    const { container } = render(<LinkedInToPortfolioPage />);
    const post = getPostBySlug("linkedin-to-portfolio")!;
    const time = container.querySelector("time[datetime]");
    const row = time?.parentElement?.parentElement;

    expect(time?.getAttribute("datetime")).toBe(post.dateModified ?? post.date);
    expect(row?.className).toContain("flex-wrap");

    const separators = Array.from(row?.querySelectorAll("[aria-hidden]") ?? []).filter(
      (el) => el.textContent?.trim() === "·",
    );

    expect(separators).toHaveLength(2);

    for (const separator of separators) {
      const group = separator.parentElement;
      expect(group).not.toBe(row);
      expect(group?.textContent?.replace(/·/g, "").trim().length).toBeGreaterThan(0);
      expect(group?.className).toContain("whitespace-nowrap");
    }
  });
});
