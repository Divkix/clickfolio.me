"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <Button type="button" onClick={handleClick} loading={isPending} className="whitespace-nowrap">
        {isLoggedIn ? "Dashboard" : "Sign in"}
      </Button>

      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
