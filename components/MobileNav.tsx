"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface NavLink {
  href: string;
  label: string;
}

/**
 * Mobile navigation drawer for the marketing header.
 * Renders a hamburger trigger that opens a full-width sheet of nav links.
 */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent className="top-0 left-0 right-0 bottom-auto max-w-full translate-x-0 translate-y-0 rounded-none rounded-b-2xl border-x-0 border-t-0 p-0 sm:max-w-full">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <Logo size="sm" />
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-4 py-4">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
