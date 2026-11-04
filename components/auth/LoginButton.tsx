import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SignInButton, useSession } from "@/lib/auth/client";

export function LoginButton() {
  const { data: session, isPending, hasSessionHint } = useSession();
  const isLoggedIn = !isPending && !!session?.user;

  if (isLoggedIn) {
    return (
      <Button asChild className="w-28 whitespace-nowrap">
        <Link to="/dashboard">Dashboard</Link>
      </Button>
    );
  }

  if (isPending && hasSessionHint) {
    return (
      <Button type="button" disabled aria-busy="true" aria-label="Loading account" className="w-28">
        <span aria-hidden="true" className="invisible">
          Dashboard
        </span>
      </Button>
    );
  }

  return (
    <SignInButton fallbackRedirectUrl="/dashboard">
      <Button type="button" className="w-28 whitespace-nowrap">
        Sign in
      </Button>
    </SignInButton>
  );
}
