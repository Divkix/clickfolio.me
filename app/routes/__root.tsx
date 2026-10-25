import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { ReactNode } from "react";
import { TelemetryIdentity } from "@/components/analytics/TelemetryIdentity";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/auth/client";
import { siteConfig } from "@/lib/config/site";
import { getOptionalEnvValue } from "@/lib/utils/env";
import jetbrainsMonoCss from "@fontsource-variable/jetbrains-mono/index.css?url";
import onestCss from "@fontsource-variable/onest/index.css?url";
import appCss from "../globals.css?url";

/** Runtime vars the browser needs; read per request so one build serves every environment. */
const getPublicConfig = createServerFn({ method: "GET" }).handler(() => ({
  clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
  umamiWebsiteId: getOptionalEnvValue(env, "UMAMI_WEBSITE_ID") ?? "",
}));

export const Route = createRootRoute({
  loader: () => getPublicConfig(),
  // Fixed per deployment: load once with the document, never again on client navigations.
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#ffffff" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0e0f14" },
      { title: `${siteConfig.fullName} - ${siteConfig.tagline}` },
      {
        name: "description",
        content:
          "Drop your PDF résumé and get a shareable website in seconds. Free, fast, and AI-powered.",
      },
      { name: "application-name", content: siteConfig.fullName },
      { name: "author", content: siteConfig.fullName },
      { name: "creator", content: siteConfig.fullName },
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: siteConfig.fullName },
      { name: "msapplication-TileColor", content: "#D94E4E" },
      { name: "msapplication-config", content: "/browserconfig.xml" },
      { name: "is-agentic-site-type", content: "app" },
    ],
    links: [
      // Font stylesheets stay separate so Vite resolves their `url(./files/…)` font files.
      { rel: "stylesheet", href: onestCss },
      { rel: "stylesheet", href: jetbrainsMonoCss },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#D94E4E" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { clerkPublishableKey, umamiWebsiteId } = Route.useLoaderData();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider publishableKey={clerkPublishableKey}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-brand-foreground focus:rounded-md"
            >
              Skip to main content
            </a>
            {children}
            <Toaster />
            <TelemetryIdentity />
          </SessionProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.umamiBeforeSend=function(_,p){return window.__clickfolioOwner?void 0:p}",
          }}
        />
        <script
          defer
          src="https://analytics.divkix.me/s.js"
          data-website-id={umamiWebsiteId}
          data-performance="true"
          data-before-send="umamiBeforeSend"
        />
        <Scripts />
      </body>
    </html>
  );
}
