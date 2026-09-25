import { render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import BlogPage from "@/app/blog/page";
import ClaimHandleLandingPage from "@/app/lp/claim-handle/page";
import Home from "@/app/page";

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
  });

  it("renders the homepage with its upload CTA and discovery content", () => {
    const { container, getByRole } = render(<Home />);
    const h1 = container.querySelector("h1");

    expect(h1?.textContent).toMatch(/resume website builder/i);
    expect(h1?.textContent).toContain("live on the web in 30 seconds");
    expect(container.textContent).toContain("Drop your PDF");
    expect(container.textContent).toContain("Open source");
    expect(getByRole("link", { name: "Browse real portfolios" }).className).toMatch(/min-h-11/);
    expect(getByRole("link", { name: "Read our guides" }).className).toMatch(/min-h-11/);
    expect(container.textContent).toContain("or click to browse");
  });

  it("renders the claim-handle landing variant with the handle picker", () => {
    const { container, getByRole, getByLabelText } = render(<ClaimHandleLandingPage />);
    const h1 = container.querySelector("h1");

    expect(h1?.textContent).toMatch(/resume website builder/i);
    expect(h1?.textContent).toContain("Start linking.");
    expect(getByLabelText("Choose your handle")).toBeInTheDocument();
    expect(getByRole("link", { name: "Read our guides" }).className).toMatch(/min-h-11/);
  });

  it("renders a specific blog listing H1, not a generic Blog label", () => {
    const { container } = render(<BlogPage />);
    const h1 = container.querySelector("h1");

    expect(h1?.textContent).toMatch(/resume website/i);
    expect(h1?.textContent?.trim()).not.toBe("Blog");
  });
});
