import type { Metadata, Viewport } from "next";
import { PostHogIdentifier } from "@/components/PostHogIdentifier";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/config/site";
import "@fontsource-variable/hanken-grotesk/index.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./globals.css";

/** Viewport configuration for responsive design and theme color. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

/** Site-wide metadata defaults used for SEO and social sharing. */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    template: `%s | ${siteConfig.fullName}`,
    default: `${siteConfig.fullName} - ${siteConfig.tagline}`,
  },
  description:
    "Drop your PDF résumé and get a shareable website in seconds. Free, fast, and AI-powered.",
  applicationName: siteConfig.fullName,
  authors: [{ name: siteConfig.fullName }],
  creator: siteConfig.fullName,
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#D94E4E" }],
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  other: {
    "msapplication-TileColor": "#D94E4E",
    "msapplication-config": "/browserconfig.xml",
  },
};

/**
 * Root layout wrapping all pages with global HTML structure,
 * skip-link accessibility, toast notifications, and analytics.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-brand-foreground focus:rounded-md"
          >
            Skip to main content
          </a>
          <PostHogIdentifier />
          {children}
          <Toaster />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.umamiBeforeSend=function(_,p){return window.__clickfolioOwner?void 0:p}",
          }}
        />
        <script
          defer
          src="https://analytics.divkix.me/script.js"
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          data-before-send="umamiBeforeSend"
        />
      </body>
    </html>
  );
}
