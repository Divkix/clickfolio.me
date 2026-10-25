import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SignInButton, useSession } from "@/lib/auth/client";

export function LoginButton() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const isLoggedIn = !isPending && !!session?.user;

  if (isLoggedIn) {
    return (
      <Button
        type="button"
        onClick={() => navigate({ to: "/dashboard" })}
        loading={isPending}
        className="whitespace-nowrap"
      >
        Dashboard
      </Button>
    );
  }

  return (
    <SignInButton fallbackRedirectUrl="/dashboard">
      <Button type="button" className="whitespace-nowrap">
        Sign in
      </Button>
    </SignInButton>
  );
}
