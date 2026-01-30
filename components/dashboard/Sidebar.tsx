"use client";

import { Edit3, ExternalLink, Home, LogOut, Palette, Settings, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { signOut, useSession } from "@/lib/auth/client";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface UserProfile {
  handle: string | null;
}

interface ProfileResponse {
  handle?: string | null;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: session, isPending } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers refetch on route change (wizard → dashboard)
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfileLoading(false);
        return;
      }

      try {
        // Always fetch from API to get the authoritative handle
        // Session cache can be stale after handle changes
        const response = await fetch("/api/profile/me");
        if (response.ok) {
          const data = (await response.json()) as ProfileResponse;
          setProfile({ handle: data.handle ?? null });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setProfileLoading(false);
      }
    }

    if (!isPending) {
      loadProfile();
    }
  }, [session?.user, isPending, pathname]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!session?.user?.name) return "?";
    const names = session.user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  const loading = isPending || profileLoading;
  const user = session?.user;

  const navItems = [
    {
      name: "Overview",
      href: "/dashboard",
      icon: Home,
      exact: true,
    },
    {
      name: "Edit Resume",
      href: "/edit",
      icon: Edit3,
      exact: false,
    },
    {
      name: "Themes",
      href: "/themes",
      icon: Palette,
      exact: false,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      exact: false,
    },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-60 bg-white border-r border-slate-200/60 shadow-depth-sm
          flex flex-col z-50 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
        aria-label="Main navigation"
      >
        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-600 hover:text-slate-900 md:hidden transition-colors duration-300"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}

        {/* Logo Header */}
        <div className="p-4 border-b border-slate-200/60">
          <a href="/" aria-label="webresume.now home">
            <Logo size="xs" />
          </a>
        </div>

        {/* Profile Header */}
        <div className="p-4 border-b border-slate-200/60">
          {loading ? (
            <div className="animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-full mb-3" />
              <div className="h-4 bg-slate-200 rounded w-24" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.image ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-linear-to-r from-indigo-600 to-blue-600 p-0.5">
                    <div className="w-full h-full rounded-full bg-white" />
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.image}
                    alt={user.name || "User avatar"}
                    className="relative w-10 h-10 rounded-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-linear-to-r from-indigo-600 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                  {getInitials()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user.name || "User"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);

            return (
              <button
                type="button"
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  onClose?.();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-300
                  ${
                    active
                      ? "bg-linear-to-r from-indigo-600 to-blue-600 text-white shadow-depth-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }
                `}
              >
                <Icon
                  size={20}
                  className={active ? "stroke-[url(#iconGradient)]" : ""}
                  style={active ? { stroke: "currentColor" } : undefined}
                />
                <span>{item.name}</span>
              </button>
            );
          })}

          {/* View Site Link */}
          {profile?.handle && (
            <a
              href={`/${profile.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all duration-300"
              onClick={onClose}
            >
              <ExternalLink size={20} />
              <span>View Site</span>
            </a>
          )}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-200/60 mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 transition-all duration-300"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

        {/* SVG Gradient Definition for Active Icons */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      </aside>
    </>
  );
}
