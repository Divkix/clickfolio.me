"use client";

import { BarChart3, FileText, LayoutDashboard, Share2, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail: string;
}

const NAV_ITEMS = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Users", href: "/admin/users", icon: Users, exact: false },
  { name: "Resumes", href: "/admin/resumes", icon: FileText, exact: false },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3, exact: false },
  { name: "Referrals", href: "/admin/referrals", icon: Share2, exact: false },
];

export function AdminSidebar({ isOpen, onClose, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200/60
          flex flex-col z-50 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
        aria-label="Admin navigation"
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-600 hover:text-slate-900 lg:hidden transition-colors"
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>

        {/* Logo Header */}
        <div className="p-4 border-b border-slate-200/60">
          <Link href="/" aria-label="webresume.now home">
            <Logo size="xs" />
          </Link>
          <span className="ml-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${
                    active
                      ? "bg-slate-100 text-slate-900 border-l-2 border-coral"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }
                `}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin Info */}
        <div className="p-4 border-t border-slate-200/60">
          <p className="text-xs text-slate-500">Logged in as</p>
          <p className="text-sm font-medium text-slate-700 truncate">{adminEmail}</p>
        </div>
      </aside>
    </>
  );
}
