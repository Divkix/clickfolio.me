import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Resume Website for Consultants | clickfolio.me",
  description:
    "Launch a professional consulting portfolio website from your PDF resume. Privacy controls, custom URL, 10 templates — free forever with no time limits.",
  alternates: { canonical: `${siteConfig.url}/for/consultant` },
  openGraph: {
    title: "Resume Website for Consultants | clickfolio.me",
    description:
      "Launch a professional consulting portfolio website from your PDF resume. Privacy controls, custom URL, 10 templates — free forever with no time limits.",
    images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630 }],
  },
};

export default function ConsultantPage() {
  return (
    <main className="min-h-screen bg-cream paper-texture" id="main-content">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="font-black text-3xl sm:text-4xl text-ink mb-4">
          Resume Websites for Consultants
        </h1>
        <p className="text-lg text-[#6B6B6B] mb-8">
          Your expertise deserves a professional online presence. Turn your PDF resume into a
          polished consulting portfolio with a custom @handle URL — free, in 30 seconds.
        </p>

        <section className="mb-12">
          <h2 className="font-black text-xl text-ink mb-4">Why Consultants Love clickfolio.me</h2>
          <ul className="space-y-3 text-[#6B6B6B] list-disc pl-5">
            <li>
              <strong>Midnight template</strong> — dark minimal with serif headings and gold
              accents. Elegant and sophisticated, perfect for high-end consulting professionals.
            </li>
            <li>
              <strong>Minimalist Editorial template</strong> — clean, magazine-style layout that
              puts your track record in focus. No visual noise, just results.
            </li>
            <li>
              <strong>Granular privacy controls</strong> — toggle phone number and address
              visibility. Share a professional presence publicly while keeping personal contact
              details private until you choose to share them.
            </li>
            <li>
              <strong>Client engagement list</strong> — AI extracts and highlights the organizations
              you've worked with, presented in a clean timeline format that builds credibility
              instantly.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="font-black text-xl text-ink mb-4">Your Digital Business Card</h2>
          <p className="text-[#6B6B6B] mb-4">
            A clickfolio.me @handle URL is the modern consultant's business card. Put it on
            LinkedIn, in your email signature, and on proposals. Clients get a complete picture of
            your expertise before the first call.
          </p>
          <p className="text-[#6B6B6B]">
            Rich Open Graph previews ensure your portfolio looks professional when shared. Every
            detail — from typography to layout — is designed to project competence and credibility.
          </p>
        </section>

        <a
          href="/"
          className="inline-block bg-ink text-cream font-bold px-6 py-3 border-3 border-ink shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-transform"
        >
          Create Your Consulting Portfolio →
        </a>
      </div>
    </main>
  );
}
