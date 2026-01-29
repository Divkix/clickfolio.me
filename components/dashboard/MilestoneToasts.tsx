"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const MILESTONE_PREFIX = "milestone_shown_";

interface MilestoneConfig {
  threshold: number;
  key: string;
  message: string;
}

const MILESTONES: MilestoneConfig[] = [
  { threshold: 1, key: "1", message: "🎉 Someone viewed your resume!" },
  { threshold: 10, key: "10", message: "📈 10 people have seen your portfolio!" },
  { threshold: 100, key: "100", message: "🔥 Your resume is getting traction — 100 views!" },
  { threshold: 500, key: "500", message: "⭐ 500 views! You're making an impact!" },
  { threshold: 1000, key: "1000", message: "🚀 1,000 views! Your resume is on fire!" },
];

interface MilestoneToastsProps {
  /** Total page views count */
  totalViews: number;
}

/**
 * Client component that shows milestone celebration toasts
 *
 * Uses localStorage to track which milestones have been shown to prevent re-triggering.
 * Only shows one toast per milestone, per user, ever.
 */
export function MilestoneToasts({ totalViews }: MilestoneToastsProps) {
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once per mount
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Check each milestone
    for (const milestone of MILESTONES) {
      if (totalViews >= milestone.threshold) {
        const storageKey = `${MILESTONE_PREFIX}${milestone.key}`;
        const alreadyShown = localStorage.getItem(storageKey);

        if (!alreadyShown) {
          // Show toast with slight delay to let dashboard render first
          setTimeout(() => {
            toast.success(milestone.message, {
              duration: 5000,
            });
            localStorage.setItem(storageKey, "true");
          }, 1000);

          // Only show one milestone per page load
          break;
        }
      }
    }
  }, [totalViews]);

  // This component renders nothing - it's purely for side effects
  return null;
}

export type { MilestoneToastsProps };
