"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/auth/client";
import { AuthDialog } from "./AuthDialog";

export function LoginButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const isLoggedIn = !isPending && !!session?.user;

  const handleClick = () => {
    if (isLoggedIn) {
      router.push("/dashboard");
    } else {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
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
        <span>{isPending ? "..." : isLoggedIn ? "Dashboard" : "Sign in"}</span>
      </button>

      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
