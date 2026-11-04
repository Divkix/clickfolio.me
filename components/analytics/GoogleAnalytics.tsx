import { useLocation, useMatch, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { hasSessionCookie, useSession } from "@/lib/auth/client";

/** Manual page views: Enhanced Measurement's browser-history page views must stay disabled. */
export function GoogleAnalytics() {
  const location = useLocation();
  const isNavigating = useRouterState({ select: (state) => state.status !== "idle" });

  const profileId = useMatch({
    from: "/@{$handle}",
    shouldThrow: false,
    select: (match) => match.loaderData?.data.profile.id,
  });

  const { data: session, isPending, hasSessionHint } = useSession();
  const userId = session?.user.id;
  const pageView = useRef({ href: location.href, handled: false });

  useEffect(() => {
    if (pageView.current.href !== location.href) {
      pageView.current = { href: location.href, handled: false };
    }

    if (isNavigating || pageView.current.handled) return;

    // The provider reads its hint in a parent effect, after this effect on first mount.
    // Check the cookie too, but never wait for Clerk on an unhinted anonymous visit.
    if (location.pathname.startsWith("/@") && isPending && (hasSessionHint || hasSessionCookie())) {
      return;
    }

    // Owners are handled too: later session changes must not count this same visit.
    pageView.current.handled = true;

    if (profileId && userId === profileId) return;

    window.gtag?.("event", "page_view", {
      page_location: new URL(location.href, window.location.origin).href,
      page_title: document.title,
    });
  }, [
    location.href,
    location.pathname,
    isNavigating,
    profileId,
    userId,
    isPending,
    hasSessionHint,
  ]);

  return null;
}
