import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import type React from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import AdminAnalyticsPage from "@/app/(admin)/admin/analytics/page";
import AdminReferralsPage from "@/app/(admin)/admin/referrals/page";
import AdminResumesPage from "@/app/(admin)/admin/resumes/page";
import AdminUsersPage from "@/app/(admin)/admin/users/page";
import WaitingPage from "@/app/(protected)/waiting/page";
import WizardPage from "@/app/(protected)/wizard/page";
import VerifyEmailPage from "@/app/(public)/verify-email/page";
import ResetPasswordPage from "@/app/reset-password/page";
import { AttributionWidget } from "@/components/AttributionWidget";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSparkline } from "@/components/admin/AdminSparkline";
import { AdminTrafficChart } from "@/components/admin/AdminTrafficChart";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { Pagination } from "@/components/admin/Pagination";
import { ResumeStatusBadge } from "@/components/admin/ResumeStatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { UserStatusBadge } from "@/components/admin/UserStatusBadge";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginButton } from "@/components/auth/LoginButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { HighlightBlock } from "@/components/blog/HighlightBlock";
import { StatsGrid } from "@/components/blog/StatsGrid";
import { Confetti } from "@/components/Confetti";
import { AnalyticsCard } from "@/components/dashboard/AnalyticsCard";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { DashboardUploadSection } from "@/components/dashboard/DashboardUploadSection";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { MilestoneToasts } from "@/components/dashboard/MilestoneToasts";
import { RealtimeStatusListener } from "@/components/dashboard/RealtimeStatusListener";
import { ReferralStats } from "@/components/dashboard/ReferralStats";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeSelector } from "@/components/dashboard/ThemeSelector";
import { EditResumeForm } from "@/components/forms/EditResumeForm";
import { HandleForm } from "@/components/forms/HandleForm";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { BottomCTAButton } from "@/components/home/BottomCTAButton";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { FAQSection } from "@/components/home/FAQSection";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { UsageStats } from "@/components/home/UsageStats";
import { WhatYouGetSection } from "@/components/home/WhatYouGetSection";
import { Logo } from "@/components/Logo";
import { LogoIcon } from "@/components/LogoIcon";
import { LogoText } from "@/components/LogoText";
import { RelatedProfiles } from "@/components/RelatedProfiles";
import { ShareBar } from "@/components/ShareBar";
import { SharePopover } from "@/components/SharePopover";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { ResumeManagementCard } from "@/components/settings/ResumeManagementCard";
import { RoleSelectorCard } from "@/components/settings/RoleSelectorCard";
import { TemplatePreviewModal } from "@/components/templates/TemplatePreviewModal";
import { HandleStep } from "@/components/wizard/HandleStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { ThemeStep } from "@/components/wizard/ThemeStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { WizardProgress } from "@/components/wizard/WizardProgress";
import { YouAreLiveModal } from "@/components/YouAreLiveModal";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  signInSocial: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  sessionState: {
    current: {
      data: null as { user: { id: string; email: string; name: string } } | null,
      isPending: false,
    },
  },
}));

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
  useRouter: () => mocks.router,
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams("resume_id=res_123&token=token_123"),
}));

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => mocks.sessionState.current,
  signIn: {
    social: (...args: unknown[]) => mocks.signInSocial(...args),
    email: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  signUp: {
    email: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  sendVerificationEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
  resetPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
  Toaster: () => null,
}));

vi.mock("@/hooks/useResumeStatus", () => ({
  useResumeStatus: () => ({
    status: "failed",
    progress: 100,
    error: "Parsing failed",
    canRetry: true,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("uplot", () => {
  class MockUPlot {
    static paths = { spline: () => undefined };
    over = document.createElement("div");
    ctx = {
      createLinearGradient: () => ({
        addColorStop: vi.fn(),
      }),
    };
    bbox = { height: 160 };
    cursor = { idx: null, left: 0, top: 0 };
    data: unknown[];

    constructor(_opts: unknown, data: unknown[], el: HTMLElement) {
      this.data = data;
      el.appendChild(this.over);
    }

    destroy() {}
  }

  return { default: MockUPlot };
});

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds reliable products with TypeScript and Cloudflare.",
  contact: {
    email: "avery@example.com",
    phone: "555-0100",
    location: "Phoenix, AZ",
    linkedin: "https://linkedin.com/in/avery",
    github: "https://github.com/avery",
    website: "https://avery.dev",
  },
  experience: [
    {
      title: "Staff Engineer",
      company: "Acme",
      location: "Remote",
      start_date: "2022",
      end_date: "",
      description: "Led platform delivery.",
      highlights: ["Improved reliability", "Mentored engineers"],
    },
  ],
  education: [{ degree: "BS CS", institution: "State University", graduation_date: "2018" }],
  skills: [{ category: "Languages", items: ["TypeScript", "SQL"] }],
  certifications: [{ name: "Workers", issuer: "Cloudflare", date: "2025" }],
  projects: [
    {
      title: "Portfolio Engine",
      description: "Generated portfolio sites.",
      year: "2026",
      technologies: ["React"],
      url: "https://example.com",
    },
  ],
};

let _originalsCaptured = false;
let _origResizeObserver: typeof ResizeObserver | undefined;
let _origIntersectionObserver: typeof IntersectionObserver | undefined;
let _origMatchMedia: typeof window.matchMedia | undefined;
let _origClipboard: typeof navigator.clipboard | undefined;
let _origShare: typeof navigator.share | undefined;
let _origWindowOpen: typeof window.open | undefined;
let _origWindowConfirm: typeof window.confirm | undefined;

function installBrowserMocks() {
  if (!_originalsCaptured) {
    _origResizeObserver = globalThis.ResizeObserver;
    _origIntersectionObserver = globalThis.IntersectionObserver;
    _origMatchMedia = window.matchMedia;
    _origClipboard = navigator.clipboard;
    // eslint-disable-next-line typescript/unbound-method -- vitest mock assertion
    _origShare = navigator.share;
    _origWindowOpen = window.open;
    _origWindowConfirm = window.confirm;
    _originalsCaptured = true;
  }

  globalThis.ResizeObserver = class {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width: 320, height: 160 } } as ResizeObserverEntry],
        this,
      );
    }

    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;

  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    configurable: true,
  });

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  Object.defineProperty(navigator, "share", {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
  });

  window.open = vi.fn();
  window.confirm = vi.fn().mockReturnValue(true);
}

afterAll(() => {
  if (_origResizeObserver !== undefined) {
    globalThis.ResizeObserver = _origResizeObserver;
  } else {
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  }
  if (_origIntersectionObserver !== undefined) {
    globalThis.IntersectionObserver = _origIntersectionObserver;
  } else {
    delete (globalThis as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
  }
  if (_origMatchMedia !== undefined) {
    Object.defineProperty(window, "matchMedia", { value: _origMatchMedia, configurable: true });
  } else {
    delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
  }
  if (_origClipboard !== undefined) {
    Object.defineProperty(navigator, "clipboard", { value: _origClipboard, configurable: true });
  } else {
    delete (navigator as { clipboard?: typeof navigator.clipboard }).clipboard;
  }
  if (_origShare !== undefined) {
    Object.defineProperty(navigator, "share", { value: _origShare, configurable: true });
  } else {
    delete (navigator as { share?: typeof navigator.share }).share;
  }
  if (_origWindowOpen !== undefined) {
    window.open = _origWindowOpen;
  } else {
    delete (window as { open?: typeof window.open }).open;
  }
  if (_origWindowConfirm !== undefined) {
    window.confirm = _origWindowConfirm;
  } else {
    delete (window as { confirm?: typeof window.confirm }).confirm;
  }
});

describe("component smoke rendering", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionState.current = { data: null, isPending: false };
    installBrowserMocks();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
      const url = String(input);
      if (url.includes("/api/admin/analytics")) {
        return new Response(
          JSON.stringify({
            totals: { views: 1200, unique: 400, avgPerDay: 80, profilesViewed: 55 },
            changes: { views: 12, unique: 5, avgPerDay: -3 },
            daily: [{ date: "2026-05-20", views: 50, unique: 20 }],
            topProfiles: [{ handle: "avery", views: 44 }],
            referrers: [{ domain: "linkedin.com", count: 20, percent: 50 }],
            countries: [{ code: "US", name: "United States", percent: 75 }],
            devices: [{ type: "desktop", percent: 80 }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/admin/users")) {
        return new Response(
          JSON.stringify({
            users: [
              {
                id: "user_1",
                name: "Avery",
                email: "avery@example.com",
                handle: "avery",
                status: "live",
                views: 42,
                createdAt: "2026-05-20T00:00:00Z",
                isPro: true,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 25,
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/admin/resumes")) {
        return new Response(
          JSON.stringify({
            stats: { completed: 3, processing: 1, queued: 1, failed: 1 },
            resumes: [
              {
                id: "res_123",
                userEmail: "avery@example.com",
                status: "failed",
                retryCount: 1,
                totalAttempts: 2,
                lastAttemptError: "Parse failed",
                updatedAt: "2026-05-20T00:00:00Z",
              },
            ],
            total: 1,
            page: 1,
            pageSize: 25,
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/admin/referrals")) {
        return new Response(
          JSON.stringify({
            stats: { totalReferrers: 4, totalClicks: 100, conversions: 20, conversionRate: 20 },
            funnel: { clicks: 100, unique: 80, signups: 20 },
            topReferrers: [{ handle: "avery", clicks: 50, conversions: 10, rate: "20%" }],
            sources: [{ source: "homepage", percent: 60 }],
            recentConversions: [
              {
                newUserEmail: "new@example.com",
                referrerHandle: "avery",
                createdAt: "2026-05-20T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/analytics/stats")) {
        return new Response(
          JSON.stringify({
            totalViews: 1234,
            uniqueVisitors: 456,
            viewsByDay: [{ date: "2026-05-20", views: 12, uniques: 8 }],
            topReferrers: [{ referrer: "linkedin.com", count: 7 }],
            directVisits: 5,
            deviceBreakdown: [{ device: "desktop", count: 10 }],
            countryBreakdown: [{ country: "US", count: 10 }],
            period: "7d",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/upload")) {
        const isPending = url.includes("/api/upload/pending");
        return new Response(
          JSON.stringify(
            isPending
              ? { key: null, file_hash: null }
              : { key: "temp/key", remaining: { hourly: 9, daily: 49 } },
          ),
          { status: 200 },
        );
      }
      if (url.includes("/api/site-data")) {
        return new Response(
          JSON.stringify({ id: "site_1", content: resumeContent, themeId: "minimalist_editorial" }),
          { status: 200 },
        );
      }
      if (url.includes("/api/user/stats")) {
        return new Response(JSON.stringify({ referralCount: 5, isPro: false }), { status: 200 });
      }
      if (url.includes("/api/resume/latest-status")) {
        return new Response(JSON.stringify({ id: "res_123", status: "completed" }), {
          status: 200,
        });
      }
      if (url.includes("/api/resume/claim")) {
        return new Response(JSON.stringify({ resume_id: "res_123", cached: true }), {
          status: 200,
        });
      }
      if (url.includes("/api/wizard/complete")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes("/api/handle/check")) {
        return new Response(JSON.stringify({ ok: true, available: true }), { status: 200 });
      }
      throw new Error(`Unhandled fetch mock URL: ${url}`);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders standalone brand, share, admin, and dashboard components", async () => {
    const { rerender } = render(
      <div>
        <Logo />
        <LogoIcon />
        <LogoText />
        <AttributionWidget theme="minimalist-editorial" />
        <Confetti force />
        <RelatedProfiles profiles={[{ handle: "avery", name: "Avery", headline: "Engineer" }]} />
        <ShareBar title="Avery portfolio" name="Avery" handle="avery" />
        <SharePopover title="Avery portfolio" name="Avery" handle="avery" />
        <YouAreLiveModal
          open
          onOpenChange={vi.fn()}
          handle="avery"
          url="https://clickfolio.me/@avery"
        />
        <AdminHeader onMenuClick={vi.fn()} />
        <AdminSidebar isOpen onClose={vi.fn()} adminEmail="admin@example.com" />
        <AdminSparkline
          data={[
            { date: "2026-05-17", views: 1 },
            { date: "2026-05-18", views: 3 },
            { date: "2026-05-19", views: 2 },
            { date: "2026-05-20", views: 5 },
          ]}
        />
        <AdminTrafficChart data={[{ date: "2026-05-20", views: 10, unique: 2 }]} />
        <FunnelChart
          steps={[
            { label: "Visit", value: 100 },
            { label: "Signup", value: 20 },
          ]}
        />
        <HorizontalBarChart items={[{ label: "Google", value: 20, percent: 50 }]} />
        <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />
        <ResumeStatusBadge status="completed" />
        <ResumeStatusBadge status="failed" />
        <UserStatusBadge status="live" />
        <StatCard
          title="Users"
          value="42"
          icon={Users}
          iconColorClass="text-coral"
          iconBgClass="bg-coral/20"
          change={10}
        />
        <CopyLinkButton handle="avery" />
        <DashboardUploadSection />
        <EmailVerificationBanner
          email="avery@example.com"
          emailVerified={false}
          isOAuthUser={false}
        />
        <MilestoneToasts totalViews={1000} />
        <RealtimeStatusListener resumeId="res_123" currentStatus="processing" />
        <ReferralStats referralCount={2} clickCount={10} referralCode="ABCD1234" />
        <Sidebar isOpen onClose={vi.fn()} />
      </div>,
    );

    expect(screen.getAllByText("clickfolio").length).toBeGreaterThan(0);
    expect(screen.getByText("Share Clickfolio")).toBeInTheDocument();
    expect(screen.getAllByText("Users").length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: /copy/i })[0]);
    // eslint-disable-next-line typescript/unbound-method -- vitest mock assertion
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    rerender(
      <ThemeSelector
        initialThemeId="minimalist_editorial"
        initialContent={resumeContent}
        profile={{ handle: "avery", avatar_url: null }}
        referralCount={10}
        isPro={false}
      />,
    );
    expect(screen.getByText(/Choose Your Theme/)).toBeInTheDocument();
  });

  it("auto-cleans confetti after the configured duration", async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<Confetti duration={1} />);
      expect(container.firstChild).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(501);
      });

      expect(container.firstChild).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders auth controls and handles Google sign-in", async () => {
    render(
      <div>
        <GoogleButton callbackURL="/wizard" onSuccess={vi.fn()} />
        <LoginButton />
        <PasswordInput placeholder="Password" />
        <PasswordStrengthMeter
          breachCount={2}
          result={{
            score: 2,
            isAcceptable: false,
            crackTimeDisplay: "3 hours",
            crackTimeSeconds: 10_800,
            feedback: {
              warning: "Needs more variety",
              suggestions: ["Add another word"],
            },
          }}
        />
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.signInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/wizard" });
    expect(screen.getByText("Fair")).toBeInTheDocument();
    expect(screen.getByText(/data breaches/)).toBeInTheDocument();
  });

  it("renders wizard steps and exercises handle availability", async () => {
    render(
      <div>
        <HandleStep initialHandle="avery" onContinue={vi.fn()} />
        <ReviewStep content={resumeContent} onContinue={vi.fn()} />
        <ThemeStep initialTheme="minimalist_editorial" onContinue={vi.fn()} />
        <UploadStep onContinue={vi.fn()} />
        <WizardProgress currentStep={2} totalSteps={4} progress={50} />
      </div>,
    );

    expect(screen.getByText("Choose Your Handle")).toBeInTheDocument();
    expect(screen.getByText("Review Your Information")).toBeInTheDocument();
    expect(screen.getByText("Upload Your Resume")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your Handle"), { target: { value: "Avery!!" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/handle/check?handle=avery"));
  });

  it("renders forms and settings cards with existing resume data", () => {
    render(
      <div>
        <EditResumeForm initialData={resumeContent} onSave={vi.fn().mockResolvedValue(undefined)} />
        <HandleForm currentHandle="avery" />
        <HandleForm currentHandle="avery" variant="compact" />
        <PrivacySettingsForm
          initialSettings={{
            show_phone: true,
            show_address: false,
            hide_from_search: false,
            show_in_directory: true,
          }}
        />
        <DeleteAccountCard userEmail="avery@example.com" />
        <ResumeManagementCard
          resumeCount={2}
          latestResumeDate="2026-05-20T00:00:00Z"
          latestResumeStatus="failed"
          latestResumeError="Parsing failed"
          latestResumeId="res_123"
        />
        <RoleSelectorCard currentRole="senior" roleSource="ai" />
      </div>,
    );

    expect(screen.getAllByText("Publish Changes").length).toBeGreaterThan(0);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("Professional Level")).toBeInTheDocument();
  });

  it("renders homepage helper sections and template preview modal", () => {
    render(
      <div>
        <BottomCTAButton />
        <ExamplesSection profiles={DEMO_PROFILES.slice(0, 3)} />
        <FAQSection />
        <MobileStickyUpload />
        <UsageStats />
        <WhatYouGetSection />
        <HighlightBlock title="Note">Useful context</HighlightBlock>
        <StatsGrid stats={[{ label: "Users", value: "1k" }]} />
        <TemplatePreviewModal isOpen onClose={vi.fn()} selectedIndex={0} onNavigate={vi.fn()} />
      </div>,
    );

    expect(screen.getByText("Useful context")).toBeInTheDocument();
    expect(screen.getByText("What you get")).toBeInTheDocument();
    expect(screen.getByText("1k")).toBeInTheDocument();
  });

  it("fetches analytics and renders populated stats", async () => {
    render(<AnalyticsCard />);

    await waitFor(() => expect(screen.getByText("1.2k")).toBeInTheDocument());
    expect(screen.getByText("456")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(fetch).toHaveBeenCalledWith("/api/analytics/stats?period=30d");
  });

  it("renders authenticated client route pages", async () => {
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };

    const { rerender } = render(<WizardPage />);
    await waitFor(() => expect(screen.getByText("Choose Your Handle")).toBeInTheDocument());

    rerender(<WaitingPage />);
    expect(screen.getByText(/Parsing failed/)).toBeInTheDocument();

    rerender(<VerifyEmailPage />);
    expect(screen.getByText(/Email Verified/i)).toBeInTheDocument();

    rerender(<ResetPasswordPage />);
    expect(screen.getAllByText(/Reset Password/i).length).toBeGreaterThan(0);
  });

  it("renders admin client route pages with loaded API data", async () => {
    render(
      <div>
        <AdminAnalyticsPage />
        <AdminUsersPage />
        <AdminResumesPage />
        <AdminReferralsPage />
      </div>,
    );

    await waitFor(() => expect(screen.getByText("Platform Analytics")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Avery")).toBeInTheDocument());
    expect(screen.getByText("Referral Program")).toBeInTheDocument();
    expect(screen.getByText("Parse failed")).toBeInTheDocument();
  });
});
