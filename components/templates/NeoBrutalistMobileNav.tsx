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
        className="p-2 border-2 border-white bg-black text-white hover:bg-[#FFD400] hover:text-black hover:border-[#FFD400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 bg-white border-[3px] border-black shadow-[6px_6px_0_0_#000] z-50 min-w-[200px]">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 font-bold text-black hover:bg-[#FFD400] border-b-[3px] border-black last:border-b-0 focus-visible:outline-none focus-visible:bg-[#FFD400]"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
