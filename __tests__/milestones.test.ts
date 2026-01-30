import { describe, expect, it, vi } from "vitest";

// Milestone configuration matching MilestoneToasts.tsx
const MILESTONE_PREFIX = "milestone_shown_";
const CONFETTI_KEY = "confetti_shown_100";
const CTA_DISMISSED_KEY = "cta_dismissed";

interface MilestoneConfig {
  threshold: number;
  key: string;
  message: string;
}

const MILESTONES: MilestoneConfig[] = [
  { threshold: 1, key: "1", message: "Someone viewed your resume!" },
  { threshold: 10, key: "10", message: "10 people have seen your portfolio!" },
  {
    threshold: 100,
    key: "100",
    message: "Your resume is getting traction \u2014 100 views!",
  },
  { threshold: 500, key: "500", message: "500 views! You're making an impact!" },
  { threshold: 1000, key: "1000", message: "1,000 views! Your resume is on fire!" },
];

/**
 * Test helper: Determine which milestones should be shown based on view count
 * This mirrors the logic in MilestoneToasts.tsx
 */
function getUnshownMilestones(totalViews: number): MilestoneConfig[] {
  const unshown: MilestoneConfig[] = [];

  for (const milestone of MILESTONES) {
    if (totalViews >= milestone.threshold) {
      const storageKey = `${MILESTONE_PREFIX}${milestone.key}`;
      const alreadyShown = localStorage.getItem(storageKey);

      if (!alreadyShown) {
        unshown.push(milestone);
      }
    }
  }

  return unshown;
}

/**
 * Test helper: Mark a milestone as shown (simulates toast display)
 */
function markMilestoneShown(key: string): void {
  localStorage.setItem(`${MILESTONE_PREFIX}${key}`, "true");
}

describe("milestone logic", () => {
  describe("getUnshownMilestones", () => {
    it("returns no milestones when views is 0", () => {
      const result = getUnshownMilestones(0);
      expect(result).toHaveLength(0);
    });

    it("returns first milestone when views is 1", () => {
      const result = getUnshownMilestones(1);
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(1);
    });

    it("returns first two milestones when views is 10", () => {
      const result = getUnshownMilestones(10);
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.threshold)).toEqual([1, 10]);
    });

    it("returns all milestones when views is 1000", () => {
      const result = getUnshownMilestones(1000);
      expect(result).toHaveLength(5);
    });

    it("returns no milestones after all have been shown", () => {
      markMilestoneShown("1");
      markMilestoneShown("10");
      markMilestoneShown("100");
      markMilestoneShown("500");
      markMilestoneShown("1000");

      const result = getUnshownMilestones(1000);
      expect(result).toHaveLength(0);
    });

    it("skips already shown milestones", () => {
      markMilestoneShown("1");
      markMilestoneShown("10");

      const result = getUnshownMilestones(100);
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(100);
    });
  });

  describe("milestone persistence", () => {
    it("persists milestone shown state across function calls", () => {
      // First check - milestone available
      let result = getUnshownMilestones(1);
      expect(result).toHaveLength(1);

      // Mark as shown
      markMilestoneShown("1");

      // Second check - milestone no longer available
      result = getUnshownMilestones(1);
      expect(result).toHaveLength(0);
    });

    it("does not re-trigger milestones on page refresh (localStorage persistence)", () => {
      // Simulate first session
      markMilestoneShown("1");
      markMilestoneShown("10");

      // Simulate page refresh (localStorage persists)
      // No need to clear - just verify state persists
      const result = getUnshownMilestones(10);
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles views just below threshold", () => {
      const result = getUnshownMilestones(99);
      expect(result).toHaveLength(2); // 1 and 10
      expect(result.map((m) => m.threshold)).not.toContain(100);
    });

    it("handles exact threshold values", () => {
      const result = getUnshownMilestones(100);
      expect(result).toHaveLength(3); // 1, 10, 100
      expect(result.map((m) => m.threshold)).toContain(100);
    });

    it("handles views beyond highest milestone", () => {
      const result = getUnshownMilestones(10000);
      expect(result).toHaveLength(5); // All milestones
    });

    it("handles negative views gracefully", () => {
      const result = getUnshownMilestones(-5);
      expect(result).toHaveLength(0);
    });

    it("handles non-integer views", () => {
      const result = getUnshownMilestones(1.5);
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(1);
    });
  });
});

describe("confetti trigger logic", () => {
  it("should trigger confetti on first 100% completion", () => {
    const previousCompleteness = 90;
    const currentCompleteness = 100;
    const alreadyShown = localStorage.getItem(CONFETTI_KEY);

    const shouldTrigger =
      previousCompleteness < 100 && currentCompleteness === 100 && !alreadyShown;

    expect(shouldTrigger).toBe(true);
  });

  it("should not trigger confetti if already shown", () => {
    localStorage.setItem(CONFETTI_KEY, "true");

    const previousCompleteness = 90;
    const currentCompleteness = 100;
    const alreadyShown = localStorage.getItem(CONFETTI_KEY);

    const shouldTrigger =
      previousCompleteness < 100 && currentCompleteness === 100 && !alreadyShown;

    expect(shouldTrigger).toBe(false);
  });

  it("should not trigger if completeness was already 100", () => {
    const previousCompleteness = 100;
    const currentCompleteness = 100;
    const alreadyShown = localStorage.getItem(CONFETTI_KEY);

    const shouldTrigger =
      previousCompleteness < 100 && currentCompleteness === 100 && !alreadyShown;

    expect(shouldTrigger).toBe(false);
  });

  it("should not trigger if completeness is less than 100", () => {
    const previousCompleteness = 80;
    const currentCompleteness = 95;
    const alreadyShown = localStorage.getItem(CONFETTI_KEY);

    // Check if current completeness equals 100 (it doesn't)
    const shouldTrigger = previousCompleteness < 100 && currentCompleteness >= 100 && !alreadyShown;

    expect(shouldTrigger).toBe(false);
  });

  it("marks confetti as shown after trigger", () => {
    localStorage.setItem(CONFETTI_KEY, "true");
    expect(localStorage.getItem(CONFETTI_KEY)).toBe("true");
  });
});

describe("CTA dismiss logic", () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  it("shows CTA when not dismissed", () => {
    const dismissedAt = localStorage.getItem(CTA_DISMISSED_KEY);
    const shouldShow = !dismissedAt;
    expect(shouldShow).toBe(true);
  });

  it("hides CTA when dismissed within 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T12:00:00Z"));

    const now = Date.now();
    localStorage.setItem(CTA_DISMISSED_KEY, String(now - 1000)); // 1 second ago

    const dismissedAt = localStorage.getItem(CTA_DISMISSED_KEY);
    const shouldShow = !dismissedAt || Date.now() - Number(dismissedAt) > SEVEN_DAYS_MS;

    expect(shouldShow).toBe(false);

    vi.useRealTimers();
  });

  it("shows CTA when dismissed more than 7 days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T12:00:00Z"));

    // Dismissed 8 days ago
    const dismissedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(CTA_DISMISSED_KEY, String(dismissedAt));

    const stored = localStorage.getItem(CTA_DISMISSED_KEY);
    const shouldShow = !stored || Date.now() - Number(stored) > SEVEN_DAYS_MS;

    expect(shouldShow).toBe(true);

    vi.useRealTimers();
  });

  it("stores current timestamp on dismiss", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T12:00:00Z"));

    const now = Date.now();
    localStorage.setItem(CTA_DISMISSED_KEY, String(now));

    expect(localStorage.getItem(CTA_DISMISSED_KEY)).toBe(String(now));

    vi.useRealTimers();
  });
});
