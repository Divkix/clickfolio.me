"use client";

import { Confetti as NeoConfetti } from "@neoconfetti/react";
import { useEffect, useState } from "react";

interface ConfettiProps {
  /** Number of confetti particles (default: 100, mobile: 50) */
  particleCount?: number;
  /** Duration in milliseconds (default: 3000) */
  duration?: number;
  /** Colors for confetti particles */
  colors?: string[];
  /** Force to show (bypasses auto-cleanup) */
  force?: boolean;
}

const DEFAULT_COLORS = [
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
];

/**
 * Confetti celebration component
 *
 * Wraps @neoconfetti/react with sensible defaults and mobile optimization.
 * Auto-cleans up after animation completes.
 *
 * @example
 * ```tsx
 * const [showConfetti, setShowConfetti] = useState(false);
 *
 * // Trigger confetti
 * setShowConfetti(true);
 *
 * return showConfetti && <Confetti />;
 * ```
 */
export function Confetti({
  particleCount,
  duration = 3000,
  colors = DEFAULT_COLORS,
  force = false,
}: ConfettiProps) {
  const [show, setShow] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile for reduced particle count
    setIsMobile(window.innerWidth < 768);

    // Auto-cleanup after animation
    if (!force) {
      const timer = setTimeout(() => {
        setShow(false);
      }, duration + 500); // Extra 500ms buffer

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, force]);

  if (!show) return null;

  const count = particleCount ?? (isMobile ? 50 : 100);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden="true">
      <NeoConfetti
        particleCount={count}
        duration={duration}
        colors={colors}
        stageHeight={typeof window !== "undefined" ? window.innerHeight : 800}
        stageWidth={typeof window !== "undefined" ? window.innerWidth : 400}
      />
    </div>
  );
}

export default Confetti;
