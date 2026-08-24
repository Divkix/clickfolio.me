"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SignInButton, useSession } from "@/lib/auth/client";

export function LoginButton() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const isLoggedIn = !isPending && !!session?.user;

  if (isLoggedIn) {
    return (
      <Button
        type="button"
        onClick={() => router.push("/dashboard")}
        loading={isPending}
        className="whitespace-nowrap"
      >
        Dashboard
      </Button>
    );
  }

  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
      <Button type="button" loading={isPending} className="whitespace-nowrap">
        Sign in
      </Button>
    </SignInButton>
  );
}
