"use client";

import { useState } from "react";
import { AuthDialog } from "./AuthDialog";

export function LoginButton() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="
          group
          relative
          px-5
          py-2.5
          bg-ink
          text-cream
          font-black
          border-3
          border-ink
          shadow-brutal-sm
          hover:-translate-x-0.5
          hover:-translate-y-0.5
          hover:shadow-brutal-md
          active:translate-x-0
          active:translate-y-0
          active:shadow-none
          transition-all
          duration-150
          flex
          items-center
          gap-2
        "
      >
        <span>Sign in</span>
      </button>

      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
