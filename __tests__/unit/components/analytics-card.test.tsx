import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AnalyticsCard } from "@/components/dashboard/AnalyticsCard";

type MockCursor = { idx: number | null; left: number; top: number };

const chartEvents = vi.hoisted(() => ({
  destroyed: vi.fn(),
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
    cursor: MockCursor = { idx: null, left: 320, top: 30 };
    data: unknown[];

    constructor(
      opts: { plugins?: Array<{ hooks?: Record<string, (u: MockUPlot) => void> }> },
      data: unknown[],
      el: HTMLElement,
    ) {
      this.data = data;
      el.appendChild(this.over);

      for (const plugin of opts.plugins ?? []) {
        plugin.hooks?.init?.(this);
        plugin.hooks?.setCursor?.(this);
        this.cursor.idx = 0;
        plugin.hooks?.setCursor?.(this);
        this.cursor.idx = 99;
        plugin.hooks?.setCursor?.(this);
      }
    }

    destroy() {
      chartEvents.destroyed();
    }
  }

  return { default: MockUPlot };
});

vi.mock("@/components/dashboard/MilestoneToasts", () => ({
  MilestoneToasts: ({ totalViews }: { totalViews: number }) => (
    <div data-testid="milestone">{totalViews}</div>
  ),
}));

const originalResizeObserver = globalThis.ResizeObserver;

const originalFetch = globalThis.fetch;

function installResizeObserver(width = 420) {
  globalThis.ResizeObserver = class {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: new DOMRectReadOnly(0, 0, width, 160),
            borderBoxSize: [{ blockSize: 160, inlineSize: width }],
            contentBoxSize: [{ blockSize: 160, inlineSize: width }],
            devicePixelContentBoxSize: [{ blockSize: 160, inlineSize: width }],
          },
        ],
        this,
      );
    }

    unobserve() {}
    disconnect() {}
  };
}

const baseStats = {
  totalViews: 1500,
  uniqueVisitors: 42,
  viewsByDay: [
    { date: "2026-05-18", views: 1, uniques: 1 },
    { date: "2026-05-19", views: 4, uniques: 2 },
  ],
  topReferrers: [
    { referrer: "linkedin.com", count: 6 },
    { referrer: "google.com", count: 5 },
    { referrer: "x.com", count: 4 },
    { referrer: "hidden.example", count: 3 },
  ],
  directVisits: 9,
  deviceBreakdown: [
    { device: "desktop", count: 8 },
    { device: "mobile", count: 7 },
    { device: "tablet", count: 6 },
    { device: "console", count: 5 },
  ],
  countryBreakdown: [{ country: "US", count: 12 }],
  period: "7d",
};

describe("AnalyticsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installResizeObserver();
  });

  afterEach(() => {
    if (originalResizeObserver === undefined) {
      Reflect.deleteProperty(globalThis, "ResizeObserver");
    } else {
      globalThis.ResizeObserver = originalResizeObserver;
    }

    if (originalFetch === undefined) {
      Reflect.deleteProperty(globalThis, "fetch");
    } else {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders loaded analytics, formats large numbers, and refetches selected periods", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(baseStats))
      .mockResolvedValueOnce(Response.json({ ...baseStats, totalViews: 24, period: "30d" }));

    render(<AnalyticsCard />);

    expect(await screen.findByText("1.5k")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();
    expect(screen.queryByText("hidden.example")).not.toBeInTheDocument();
    expect(screen.getByText("console")).toBeInTheDocument();
    expect(screen.getByTestId("milestone")).toHaveTextContent("1500");

    fireEvent.click(screen.getByRole("button", { name: "30d" }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenLastCalledWith("/api/analytics/stats?period=30d"),
    );
    await waitFor(() => expect(screen.getAllByText("24").length).toBeGreaterThan(0));
  });

  it("renders loading, error, empty, and no-source states", async () => {
    let resolveStats: (value: Response) => void = () => undefined;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveStats = resolve;
        }),
    );

    const { unmount } = render(<AnalyticsCard />);
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    resolveStats(new Response("broken", { status: 503 }));

    expect(
      await screen.findByText("Failed to load analytics. Try refreshing."),
    ).toBeInTheDocument();
    unmount();

    globalThis.fetch = vi.fn(async () =>
      Response.json({ ...baseStats, totalViews: 0, directVisits: 0, topReferrers: [] }),
    );
    const empty = render(<AnalyticsCard />);
    expect(await screen.findByText("No views yet")).toBeInTheDocument();
    empty.unmount();

    globalThis.fetch = vi.fn(async () =>
      Response.json({
        ...baseStats,
        uniqueVisitors: null,
        directVisits: 0,
        topReferrers: [],
        deviceBreakdown: [],
      }),
    );
    render(<AnalyticsCard />);
    expect(await screen.findByText("No traffic sources yet")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
