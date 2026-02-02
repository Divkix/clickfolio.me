"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  adminEmail: string;
}

export function AdminLayoutClient({ children, adminEmail }: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        adminEmail={adminEmail}
      />

      <div className="lg:pl-64">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 lg:p-6">
          <a href="#main-content" className="sr-only focus:not-sr-only">
            Skip to main content
          </a>
          <div id="main-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
