import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => {
  const state = {
    selectResults: [] as unknown[][],
    session: {
      user: { id: "user_1", email: "avery@example.com", name: "Avery Quinn" },
    } as { user: { id: string; email: string; name: string } } | null,
    dashboardMode: "published" as "published" | "empty" | "processing",
  };

  const nextSelectResult = () => state.selectResults.shift() ?? [];
  const createChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      values: vi.fn(() => chain),
      // eslint-disable-next-line unicorn/no-thenable -- Drizzle query mocks must be awaitable.
      then: vi.fn((resolve: (value: unknown[]) => unknown) => resolve(nextSelectResult())),
    };
    return chain;
  };

  const db = {
    query: {
      user: { findFirst: vi.fn() },
      siteData: { findFirst: vi.fn() },
      resumes: { findFirst: vi.fn() },
    },
    select: vi.fn(() => createChain()),
  };

  return {
    state,
    db,
    env: { CLICKFOLIO_DB: {} },
    redirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("notFound");
    }),
    requireAdminAuth: vi.fn(async () => undefined),
    getStats: vi.fn(async () => ({ pageviews: 111, visitors: 22 })),
    getPageviews: vi.fn(async () => ({
      pageviews: [{ x: "2026-05-20T00:00:00Z", y: 9 }],
      sessions: [],
    })),
  };
});

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(async () => mocks.state.session),
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuth: mocks.requireAdminAuth,
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: mocks.state.session, isPending: false }),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mocks.db),
}));

vi.mock("@/lib/umami/client", () => ({
  getStats: mocks.getStats,
  getPageviews: mocks.getPageviews,
}));

vi.mock("drizzle-orm", () => ({
  relations: vi.fn((_table, build) =>
    build({
      many: vi.fn((table) => ({ relation: "many", table })),
      one: vi.fn((table, config) => ({ relation: "one", table, config })),
    }),
  ),
  eq: vi.fn((_field, value) => ({ op: "eq", value })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
  or: vi.fn((...conditions) => ({ op: "or", conditions })),
  ne: vi.fn((_field, value) => ({ op: "ne", value })),
  desc: vi.fn((field) => ({ op: "desc", field })),
  isNotNull: vi.fn((field) => ({ op: "isNotNull", field })),
  count: vi.fn(() => ({ op: "count" })),
  sql: vi.fn(() => ({ op: "sql" })),
}));

vi.mock("@/components/dashboard/AnalyticsCard", () => ({
  AnalyticsCard: () => <div>analytics-card</div>,
}));
vi.mock("@/components/dashboard/CopyLinkButton", () => ({
  CopyLinkButton: ({ handle }: { handle: string }) => <button type="button">copy {handle}</button>,
}));
vi.mock("@/components/dashboard/DashboardUploadSection", () => ({
  DashboardUploadSection: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children || "upload-section"}</button>
  ),
}));
vi.mock("@/components/dashboard/EmailVerificationBanner", () => ({
  EmailVerificationBanner: ({ email }: { email: string }) => <div>verify {email}</div>,
}));
vi.mock("@/components/dashboard/RealtimeStatusListener", () => ({
  RealtimeStatusListener: ({ currentStatus }: { currentStatus: string }) => (
    <div>realtime {currentStatus}</div>
  ),
}));
vi.mock("@/components/dashboard/ReferralStats", () => ({
  ReferralStats: ({ referralCode }: { referralCode: string }) => <div>referral {referralCode}</div>,
}));
vi.mock("@/components/dashboard/ThemeSelector", () => ({
  ThemeSelector: ({ initialThemeId }: { initialThemeId: string }) => (
    <div>theme {initialThemeId}</div>
  ),
}));

vi.mock("@/components/forms/EditResumeFormWrapper", () => ({
  EditResumeFormWrapper: ({ initialData }: { initialData: ResumeContent }) => (
    <div>edit-wrapper {initialData.full_name}</div>
  ),
}));
vi.mock("@/components/forms/HandleForm", () => ({
  HandleForm: ({ currentHandle }: { currentHandle: string }) => <div>handle {currentHandle}</div>,
}));
vi.mock("@/components/forms/PrivacySettings", () => ({
  PrivacySettingsForm: () => <div>privacy-settings</div>,
}));
vi.mock("@/components/settings/DeleteAccountCard", () => ({
  DeleteAccountCard: ({ userEmail }: { userEmail: string }) => <div>delete {userEmail}</div>,
}));
vi.mock("@/components/settings/ResumeManagementCard", () => ({
  ResumeManagementCard: ({ resumeCount }: { resumeCount: number }) => (
    <div>resumes {resumeCount}</div>
  ),
}));
vi.mock("@/components/settings/RoleSelectorCard", () => ({
  RoleSelectorCard: ({ currentRole }: { currentRole: string | null }) => (
    <div>role {currentRole}</div>
  ),
}));
vi.mock("@/components/admin/AdminHeader", () => ({
  AdminHeader: ({ onMenuClick }: { onMenuClick: () => void }) => (
    <button type="button" onClick={onMenuClick}>
      admin-header
    </button>
  ),
}));
vi.mock("@/components/admin/AdminSidebar", () => ({
  AdminSidebar: ({ isOpen, adminEmail }: { isOpen: boolean; adminEmail?: string }) => (
    <div>
      admin-sidebar {adminEmail} {isOpen ? "open" : "closed"}
    </div>
  ),
}));
vi.mock("@/components/admin/AdminSparkline", () => ({
  AdminSparkline: ({ data }: { data: unknown[] }) => <div>sparkline {data.length}</div>,
}));
vi.mock("@/components/admin/StatCard", () => ({
  StatCard: ({ title, value }: { title: string; value: string | number }) => (
    <div>
      {title}: {value}
    </div>
  ),
}));

vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => <header>site-header</header> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer>footer</footer> }));
vi.mock("@/components/ui/Breadcrumb", () => ({ Breadcrumb: () => <nav>breadcrumb</nav> }));
vi.mock("@/components/analytics/OwnerDetector", () => ({
  OwnerDetector: ({ profileId }: { profileId: string }) => <div>owner {profileId}</div>,
}));

vi.mock("@/lib/templates/theme-registry", () => ({
  getTemplate: vi.fn(async () => ({ content }: { content: ResumeContent }) => (
    <article>{content.full_name} template</article>
  )),
}));

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds reliable products with TypeScript and Cloudflare.",
  contact: {
    email: "avery@example.com",
    phone: "555-0100",
    location: "Phoenix, AZ, USA",
    website: "https://avery.dev",
  },
  experience: [
    {
      title: "Staff Engineer",
      company: "Acme",
      start_date: "2022",
      description: "Built reliable products.",
      highlights: [],
    },
  ],
  education: [{ degree: "BS CS", institution: "State University" }],
  skills: [{ category: "Languages", items: ["TypeScript", "SQL", "React", "Workers", "D1"] }],
  certifications: [],
  projects: [],
};

function siteDataRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "site_1",
    userId: "user_1",
    resumeId: "res_1",
    content: JSON.stringify(resumeContent),
    themeId: "minimalist_editorial",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z",
    lastPublishedAt: "2026-05-20T00:00:00Z",
    previewName: "Avery Quinn",
    previewHeadline: "Staff Product Engineer",
    previewLocation: "Phoenix, AZ",
    previewExpCount: 1,
    previewEduCount: 1,
    previewSkills: JSON.stringify(["TypeScript", "SQL", "React", "Workers", "D1"]),
    ...overrides,
  };
}

function installDbDefaults() {
  mocks.db.query.user.findFirst.mockImplementation(
    async (args: { with?: Record<string, unknown>; columns?: Record<string, boolean> } = {}) => {
      if (args.with && "resumes" in args.with) {
        if (mocks.state.dashboardMode === "empty") {
          return {
            id: "user_1",
            handle: "avery",
            name: "Avery Quinn",
            email: "avery@example.com",
            emailVerified: false,
            image: null,
            headline: "Engineer",
            privacySettings: "{}",
            onboardingCompleted: true,
            createdAt: "2026-05-20T00:00:00Z",
            referralCount: 0,
            referralCode: null,
            resumes: [],
            siteData: null,
            accounts: [],
          };
        }
        return {
          id: "user_1",
          handle: "avery",
          name: "Avery Quinn",
          email: "avery@example.com",
          emailVerified: false,
          image: null,
          headline: "Engineer",
          privacySettings: "{}",
          onboardingCompleted: true,
          createdAt: "2026-05-20T00:00:00Z",
          referralCount: 3,
          referralCode: "REF123",
          resumes: [
            {
              id: "res_1",
              status: mocks.state.dashboardMode === "processing" ? "processing" : "failed",
              errorMessage: "Parse failed",
              createdAt: "2026-05-20T00:00:00Z",
            },
          ],
          siteData: mocks.state.dashboardMode === "processing" ? null : siteDataRow(),
          accounts: [{ providerId: "google" }],
        };
      }

      if (args.columns?.isPro) {
        return { handle: "avery", image: null, isPro: false, referralCount: 3 };
      }

      if (args.with && "siteData" in args.with) {
        return {
          id: "user_1",
          name: "Avery Quinn",
          email: "avery@example.com",
          handle: "avery",
          headline: "Staff Product Engineer",
          image: null,
          privacySettings: JSON.stringify({
            show_phone: false,
            show_address: false,
            hide_from_search: false,
            show_in_directory: true,
          }),
          isPro: false,
          referralCount: 0,
          siteData: siteDataRow(),
        };
      }

      return {
        id: "user_1",
        email: "avery@example.com",
        handle: "avery",
        headline: "Staff Product Engineer",
        image: null,
        privacySettings: "{}",
        role: "senior",
        roleSource: "ai",
      };
    },
  );

  mocks.db.query.siteData.findFirst.mockResolvedValue(siteDataRow());
  mocks.db.query.resumes.findFirst.mockResolvedValue({
    id: "res_1",
    createdAt: "2026-05-20T00:00:00Z",
    status: "failed",
    errorMessage: "Parse failed",
  });
}

describe("server rendered app pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.selectResults = [];
    mocks.state.session = {
      user: { id: "user_1", email: "avery@example.com", name: "Avery Quinn" },
    };
    mocks.state.dashboardMode = "published";
    installDbDefaults();
  });

  it("renders protected dashboard states", async () => {
    const { default: DashboardPage } = await import("@/app/(protected)/dashboard/page");

    mocks.state.selectResults = [[{ count: 7 }]];
    render(await DashboardPage());
    expect(screen.getByText("Avery Quinn")).toBeInTheDocument();
    expect(screen.getAllByText(/Parse failed/).length).toBeGreaterThan(0);
    expect(screen.getByText("referral REF123")).toBeInTheDocument();

    mocks.state.dashboardMode = "empty";
    mocks.state.selectResults = [[{ count: 0 }]];
    render(await DashboardPage());
    expect(screen.getByText("No Resume Yet")).toBeInTheDocument();

    mocks.state.session = null;
    await expect(DashboardPage()).rejects.toThrow("redirect:/");
  });

  it("renders settings, edit, themes, and protected layout surfaces", async () => {
    const { default: SettingsPage } = await import("@/app/(protected)/settings/page");
    const { default: EditPage } = await import("@/app/(protected)/edit/page");
    const { default: ThemesPage } = await import("@/app/(protected)/themes/page");
    const { default: ProtectedLayout } = await import("@/app/(protected)/layout");
    const { SidebarLayoutClient } = await import("@/app/(protected)/SidebarLayoutClient");

    mocks.state.selectResults = [[{ count: 2, latestId: "res_1" }]];
    render(await SettingsPage());
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("resumes 2")).toBeInTheDocument();

    render(await EditPage());
    expect(screen.getByText("Edit Resume")).toBeInTheDocument();
    expect(screen.getByText("edit-wrapper Avery Quinn")).toBeInTheDocument();

    render(await ThemesPage());
    expect(screen.getByText("theme minimalist_editorial")).toBeInTheDocument();

    render(<ProtectedLayout>child</ProtectedLayout>);
    expect(screen.getByText("child")).toBeInTheDocument();

    render(<SidebarLayoutClient>body</SidebarLayoutClient>);
    await userEvent.click(screen.getAllByRole("button", { name: /open navigation menu/i })[0]);
    expect(document.body.style.overflow).toBe("hidden");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("unset"));
  });

  it("renders explore directory with filters and pagination", async () => {
    const { default: ExplorePage } = await import("@/app/explore/page");
    mocks.state.selectResults = [
      [{ count: 13 }],
      [
        {
          handle: "avery",
          role: "senior",
          previewName: "Avery Quinn",
          previewHeadline: "Engineer",
          previewLocation: "Phoenix, AZ",
          previewExpCount: 1,
          previewEduCount: 1,
          previewSkills: JSON.stringify(["TypeScript", "SQL", "React", "Workers", "D1"]),
        },
      ],
    ];

    render(await ExplorePage({ searchParams: Promise.resolve({ page: "2", role: "senior" }) }));
    expect(screen.getByText("Explore Professionals")).toBeInTheDocument();
    expect(screen.getByText("Avery Quinn")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("renders public handle page, metadata, and preview page", async () => {
    mocks.db.query.user.findFirst.mockResolvedValue({
      id: "user_1",
      name: "Avery Quinn",
      email: "avery@example.com",
      handle: "avery",
      headline: "Staff Product Engineer",
      image: null,
      privacySettings: JSON.stringify({
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      }),
      isPro: false,
      referralCount: 0,
      siteData: siteDataRow(),
    });
    const handlePage = await import("@/app/[handle]/page");
    mocks.state.selectResults = [[{ handle: "casey", name: "Casey", headline: "Designer" }]];

    const metadata = await handlePage.generateMetadata({
      params: Promise.resolve({ handle: "%40avery" }),
    });
    expect(metadata.title).toContain("Avery Quinn");

    render(await handlePage.default({ params: Promise.resolve({ handle: "%40avery" }) }));
    expect(screen.getByText("Avery Quinn template")).toBeInTheDocument();
    expect(screen.getByText("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText(/owner user_1/)).toBeInTheDocument();

    await expect(
      handlePage.default({ params: Promise.resolve({ handle: "avery" }) }),
    ).rejects.toThrow("notFound");

    const { default: PreviewPage } = await import("@/app/preview/[id]/page");
    render(await PreviewPage({ params: Promise.resolve({ id: "classic_ats" }) }));
    expect(screen.getAllByText(/template/).length).toBeGreaterThan(1);
  });

  it("renders admin overview and admin layout", async () => {
    const { default: AdminOverviewPage } = await import("@/app/(admin)/admin/page");
    const { default: AdminLayout } = await import("@/app/(admin)/admin/layout");
    const { AdminLayoutClient } = await import("@/app/(admin)/admin/layout-client");

    mocks.state.selectResults = [
      [{ count: 10 }],
      [{ count: 6 }],
      [
        { status: "processing", count: 2 },
        { status: "queued", count: 1 },
        { status: "failed", count: 2 },
      ],
      [{ email: "new@example.com", name: "New User", createdAt: new Date().toISOString() }],
    ];

    render(await AdminOverviewPage());
    expect(screen.getByText("Total Users: 10")).toBeInTheDocument();
    expect(screen.getByText("Processing: 3")).toBeInTheDocument();
    expect(screen.getByText(/2 Failed Resumes/)).toBeInTheDocument();
    expect(screen.getByText("New User")).toBeInTheDocument();

    render(await AdminLayout({ children: <div>admin-child</div> }));
    expect(screen.getByText("admin-child")).toBeInTheDocument();

    render(<AdminLayoutClient>admin-body</AdminLayoutClient>);
    await userEvent.click(screen.getAllByRole("button", { name: "admin-header" })[0]);
    expect(screen.getByText(/open/)).toBeInTheDocument();
  });
});
