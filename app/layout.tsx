import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/config/site";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff6ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${siteConfig.fullName} - ${siteConfig.tagline}`,
  description:
    "Drop your PDF résumé and get a shareable website in seconds. Free, fast, and AI-powered.",
  applicationName: siteConfig.fullName,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.fullName }],
  creator: siteConfig.fullName,
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
  openGraph: {
    siteName: siteConfig.fullName,
  },
  other: {
    "msapplication-TileColor": "#D94E4E",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-coral focus:text-white focus:rounded-md"
        >
          Skip to main content
        </a>
        {children}
        <Toaster />
        <Script
          defer
          src="https://analytics.divkix.me/s.js"
          data-website-id="1a0515d6-8471-4a14-8581-3fdc3929ff0c"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
