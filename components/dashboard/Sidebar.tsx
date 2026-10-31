import { Edit3, ExternalLink, Home, LogOut, Palette, Settings, Shield, X } from "lucide-react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useSession, useSignOut } from "@/lib/auth/client";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  handle: string | null;
  isAdmin: boolean;
}

export function Sidebar({ isOpen = true, onClose, handle, isAdmin }: SidebarProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const router = useRouter();
  const navigate = useNavigate();
  const signOut = useSignOut();

  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut();
    await navigate({ to: "/" });
    await router.invalidate();
  };

  const getInitials = () => {
    if (!session?.user?.name) return "?";
    const names = session.user.name.split(" ");

    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }

    return names[0][0].toUpperCase();
  };

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
      name: "Templates",
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
  ] satisfies { name: string; href: LinkProps["to"]; icon: typeof Home; exact: boolean }[];

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }

    return pathname?.startsWith(href);
  };

  return (
    <>
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-60 bg-card border-r border-border
          flex flex-col z-50 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
        aria-label="Main navigation"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground md:hidden transition-colors duration-300"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}

        <div className="px-5 h-16 flex items-center">
          <Link to="/" aria-label="clickfolio.me home">
            <Logo size="xs" />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);

            return (
              <Link
                to={item.href}
                key={item.href}
                onClick={() => onClose?.()}
                aria-current={active ? "page" : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }
                `}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {(handle || isAdmin) && <div className="h-px bg-border mx-3 my-3" />}

          {handle && (
            <Link
              to="/@{$handle}"
              params={{ handle }}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
              onClick={onClose}
            >
              <ExternalLink size={18} aria-hidden="true" />
              <span>View Site</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => onClose?.()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <Shield size={18} aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-border">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-1.5">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-brand-foreground font-semibold text-xs">
                  {getInitials()}
                </div>
              )}
              <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                {user.name || "User"}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
