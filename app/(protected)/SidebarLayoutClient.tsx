"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

export function SidebarLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on Escape key
  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-cream paper-texture">
      {/* Sidebar - Desktop: always visible, Mobile: controlled by state */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 right-4 z-50 p-3 bg-card border border-ink/10 rounded-lg shadow-sm md:hidden hover:shadow-md transition-all duration-300"
        aria-label="Open navigation menu"
      >
        <Menu size={24} className="text-foreground" />
      </button>

      {/* Main content area */}
      <main id="main-content" className="md:ml-60 min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
