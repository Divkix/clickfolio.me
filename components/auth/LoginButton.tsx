import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SignInButton, useSession } from "@/lib/auth/client";

export function LoginButton() {
  const { data: session, isPending } = useSession();
  const isLoggedIn = !isPending && !!session?.user;

  if (isLoggedIn) {
    return (
      <Button asChild className="whitespace-nowrap">
        <Link to="/dashboard">Dashboard</Link>
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
