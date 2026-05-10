"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

interface NavLink {
  href: string;
  label: string;
}

interface NeoBrutalistMobileNavProps {
  links: NavLink[];
}

export function NeoBrutalistMobileNav({ links }: NeoBrutalistMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (links.length === 0) return null;

  return (
    <div className="md:hidden relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="p-2 border-2 border-black bg-white hover:bg-[#FFDE00] transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 min-w-[180px]">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 font-bold text-sm uppercase text-white hover:bg-[#FFDE00] hover:text-black transition-colors border-b-2 border-white/20 last:border-b-0"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
