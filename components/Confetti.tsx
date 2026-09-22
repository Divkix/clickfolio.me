"use client";

import { Confetti as NeoConfetti } from "@neoconfetti/react";
import { useEffect, useState } from "react";

const DEFAULT_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#10b981", "#D94E4E"];

export function Confetti() {
  const [show, setShow] = useState(true);

  const [viewport] = useState(() =>
    typeof window === "undefined"
      ? { width: 400, height: 800 }
      : { width: window.innerWidth, height: window.innerHeight },
  );

  const isMobile = viewport.width < 768;

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 3500);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-100" aria-hidden="true">
      <NeoConfetti
        particleCount={isMobile ? 50 : 100}
        duration={3000}
        colors={DEFAULT_COLORS}
        stageHeight={viewport.height}
        stageWidth={viewport.width}
      />
    </div>
  );
}
