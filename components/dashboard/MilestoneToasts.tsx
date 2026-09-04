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
  totalViews: number;
}

export function MilestoneToasts({ totalViews }: MilestoneToastsProps) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    for (const milestone of MILESTONES) {
      if (totalViews >= milestone.threshold) {
        const storageKey = `${MILESTONE_PREFIX}${milestone.key}`;
        const alreadyShown = localStorage.getItem(storageKey);

        if (!alreadyShown) {
          timeoutId = setTimeout(() => {
            toast.success(milestone.message, {
              duration: 5000,
            });
            localStorage.setItem(storageKey, "true");
          }, 1000);

          break;
        }
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [totalViews]);

  return null;
}

export type { MilestoneToastsProps };
