"use client";

import { LoginButton } from "@/components/auth/LoginButton";
import { Brand } from "@/components/Brand";
import { FileDropzone } from "@/components/FileDropzone";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-slate-900">
            <Brand size="lg" />
          </div>
          <LoginButton />
        </div>
      </header>

      <main
        id="main-content"
        className="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 pb-20"
      >
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight">
            Your Resume is
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-blue-600 to-cyan-600">
              already a Website
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 mb-6 max-w-2xl mx-auto leading-relaxed font-light">
            Drop your PDF. Get a shareable link. It takes less than a minute.
          </p>

          {/* Social Proof Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-depth-sm">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-linear-to-r from-indigo-400 to-blue-400 border-2 border-white" />
                <div className="w-6 h-6 rounded-full bg-linear-to-r from-emerald-400 to-teal-400 border-2 border-white" />
                <div className="w-6 h-6 rounded-full bg-linear-to-r from-orange-400 to-amber-400 border-2 border-white" />
              </div>
              <span className="text-sm font-medium text-slate-600">
                <span className="font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-blue-600">
                  1,000+
                </span>{" "}
                resumes published
              </span>
            </div>
          </div>

          {/* Trust Signals - Compact Inline */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {/* Speed Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="bg-linear-to-r from-orange-100 to-amber-100 p-1.5 rounded-lg">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                    stroke="url(#speedGradientCompact)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="speedGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F97316" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-600">
                <span className="font-bold text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-amber-600">~30s</span> setup
              </span>
            </div>

            {/* AI Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="bg-linear-to-r from-indigo-100 to-purple-100 p-1.5 rounded-lg">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    stroke="url(#aiGradientCompact)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="aiGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#A855F7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-600">
                <span className="font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600">AI-Powered</span> parsing
              </span>
            </div>

            {/* Free Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="bg-linear-to-r from-emerald-100 to-teal-100 p-1.5 rounded-lg">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="url(#freeGradientCompact)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient id="freeGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#14B8A6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-600">
                <span className="font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600">Free</span> forever
              </span>
            </div>
          </div>

          {/* See Examples - Mini Previews */}
          <div className="mb-10">
            <p className="text-sm font-medium text-slate-500 mb-4">See live examples</p>
            <div className="flex flex-wrap justify-center gap-3">
              {/* Example 1 */}
              <div
                className="group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                role="button"
                tabIndex={0}
              >
                <div className="w-10 h-10 rounded-full bg-linear-to-r from-indigo-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  SC
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900">Sarah Chen</div>
                  <div className="text-xs text-slate-500">Product Designer</div>
                </div>
                <div className="ml-2 px-2 py-0.5 bg-indigo-50 rounded text-xs font-medium text-indigo-600">
                  Editorial
                </div>
              </div>

              {/* Example 2 */}
              <div
                className="group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                role="button"
                tabIndex={0}
              >
                <div className="w-10 h-10 rounded-full bg-linear-to-r from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                  JS
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900">John Smith</div>
                  <div className="text-xs text-slate-500">Software Engineer</div>
                </div>
                <div className="ml-2 px-2 py-0.5 bg-emerald-50 rounded text-xs font-medium text-emerald-600">
                  Brutalist
                </div>
              </div>

              {/* Example 3 */}
              <div
                className="group flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-200/60 shadow-depth-sm hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                role="button"
                tabIndex={0}
              >
                <div className="w-10 h-10 rounded-full bg-linear-to-r from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                  MR
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900">Maria Rodriguez</div>
                  <div className="text-xs text-slate-500">Marketing Lead</div>
                </div>
                <div className="ml-2 px-2 py-0.5 bg-purple-50 rounded text-xs font-medium text-purple-600">
                  Bento
                </div>
              </div>
            </div>
          </div>

          {/* Inline Upload Zone */}
          <div className="max-w-2xl mx-auto mb-8">
            <FileDropzone />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-600 text-sm font-medium">
            Built with Next.js | Powered by Cloudflare | Privacy-first design
          </p>
        </div>
      </footer>
    </div>
  );
}
