"use client";

import { ArrowLeft, Menu, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/users": "Users",
  "/admin/resumes": "Resumes",
  "/admin/analytics": "Analytics",
  "/admin/referrals": "Referrals",
};

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const title = PAGE_TITLES[pathname] || "Admin";

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-ink/10">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground lg:hidden transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Refresh data"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
