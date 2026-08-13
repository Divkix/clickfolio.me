"use client";

import { Confetti as NeoConfetti } from "@neoconfetti/react";
import { useEffect, useState } from "react";

const DEFAULT_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#10b981", "#D94E4E"];

export function Confetti() {
  const [show, setShow] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
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
        stageHeight={globalThis.window !== undefined ? globalThis.window.innerHeight : 800}
        stageWidth={globalThis.window !== undefined ? globalThis.window.innerWidth : 400}
      />
    </div>
  );
}
