"use client";

import { Printer } from "lucide-react";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="w-4 h-4" aria-hidden="true" />
      Print or save as PDF
    </button>
  );
}
