import { render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import ProfileNotFound from "@/app/[handle]/not-found";
import AiResumeParsingAccuracyPage, {
  generateMetadata as generateAiResumeParsingMetadata,
} from "@/app/blog/ai-resume-parsing-accuracy/page";
import BestResumeWebsiteBuildersPage, {
  generateMetadata as generateBestResumeWebsiteBuildersMetadata,
} from "@/app/blog/best-resume-website-builders/page";
import TemplatesShowcasePage, {
  generateMetadata as generateTemplatesShowcaseMetadata,
} from "@/app/blog/clickfolio-templates-showcase/page";
import BlogLayout from "@/app/blog/layout";
import LinkedInToPortfolioPage, {
  generateMetadata as generateLinkedInToPortfolioMetadata,
} from "@/app/blog/linkedin-to-portfolio/page";
import BlogPage from "@/app/blog/page";
import PdfResumeToWebsitePage, {
  generateMetadata as generatePdfResumeToWebsiteMetadata,
} from "@/app/blog/pdf-resume-to-website/page";
import PdfResumeVsPortfolioPage, {
  generateMetadata as generatePdfResumeVsPortfolioMetadata,
} from "@/app/blog/pdf-resume-vs-portfolio/page";
import PrivacyAtClickfolioPage, {
  generateMetadata as generatePrivacyAtClickfolioMetadata,
} from "@/app/blog/privacy-at-clickfolio/page";
import ResumeWritingTipsPage, {
  generateMetadata as generateResumeWritingTipsMetadata,
} from "@/app/blog/resume-writing-tips/page";
import ConsultantPage from "@/app/for/consultant/page";
import DesignerPage from "@/app/for/designer/page";
import MarketerPage from "@/app/for/marketer/page";
import ProductManagerPage from "@/app/for/product-manager/page";
import SoftwareEngineerPage from "@/app/for/software-engineer/page";
import StudentPage from "@/app/for/student/page";
import GlobalError from "@/app/global-error";
import RootNotFound from "@/app/not-found";
import Home from "@/app/page";
import PrivacyPolicyPage from "@/app/privacy/page";
import TermsOfServicePage from "@/app/terms/page";

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
  useSession: () => ({ data: null, isPending: false }),
  signIn: { social: vi.fn(), email: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
  sendVerificationEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const pages: Array<[string, React.ComponentType]> = [
  ["blog index", BlogPage],
  ["ai parsing post", AiResumeParsingAccuracyPage],
  ["resume builder post", BestResumeWebsiteBuildersPage],
  ["templates post", TemplatesShowcasePage],
  ["linkedin post", LinkedInToPortfolioPage],
  ["pdf resume post", PdfResumeToWebsitePage],
  ["pdf vs portfolio post", PdfResumeVsPortfolioPage],
  ["privacy blog post", PrivacyAtClickfolioPage],
  ["writing tips post", ResumeWritingTipsPage],
  ["consultant page", ConsultantPage],
  ["designer page", DesignerPage],
  ["marketer page", MarketerPage],
  ["product manager page", ProductManagerPage],
  ["software engineer page", SoftwareEngineerPage],
  ["student page", StudentPage],
  ["privacy page", PrivacyPolicyPage],
  ["terms page", TermsOfServicePage],
];

describe("public page rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    Object.defineProperty(navigator, "sendBeacon", {
      value: vi.fn(),
      configurable: true,
    });
  });

  it("renders the homepage with its upload CTA and discovery content", () => {
    const { container } = render(<Home />);

    expect(container.textContent).toContain("Your Resume");
    expect(container.textContent).toContain("Drop your PDF");
    expect(container.textContent).toContain("Open source");
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/referral/track",
      JSON.stringify({ code: "ABCD1234", source: "homepage" }),
    );
  });

  it.each(pages)("renders %s", (_name, Page) => {
    const { container } = render(<Page />);
    expect(container.textContent?.trim().length).toBeGreaterThan(20);
  });

  it("renders blog layout and not-found surfaces", () => {
    expect(render(<BlogLayout>Article content</BlogLayout>).container.textContent).toContain(
      "Article content",
    );
    expect(render(<RootNotFound />).container.textContent).toContain("Page Not Found");
    expect(render(<ProfileNotFound />).container.textContent).toContain("Resume Not Found");
  });

  it("renders the global error surface", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container } = render(
        <GlobalError error={new Error("fatal render failure")} reset={vi.fn()} />,
      );

      expect(container.textContent).toContain("Something went wrong");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("keeps blog metadata generators wired to titles", () => {
    const metadata = [
      generateAiResumeParsingMetadata(),
      generateBestResumeWebsiteBuildersMetadata(),
      generateTemplatesShowcaseMetadata(),
      generateLinkedInToPortfolioMetadata(),
      generatePdfResumeToWebsiteMetadata(),
      generatePdfResumeVsPortfolioMetadata(),
      generatePrivacyAtClickfolioMetadata(),
      generateResumeWritingTipsMetadata(),
    ];

    const titles = metadata.map((entry) => String(entry.title)).join("\n");

    expect(titles).toContain("AI Resume Parsing");
    expect(titles).toContain("Resume Website Builders");
    expect(titles).toContain("LinkedIn");
  });
});
