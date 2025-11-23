"use client";

import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Brand } from "@/components/Brand";
import { Toaster } from "@/components/ui/sonner";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-slate-900">
            <Brand size="lg" />
          </div>
          <Link
            href="/login"
            className="group relative px-6 py-3 bg-linear-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold shadow-depth-sm hover:shadow-depth-md hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 overflow-hidden"
          >
            {/* Shimmer effect overlay */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />

            <span className="relative z-10">Get Started Free</span>
            <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 pb-20">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight">
            Your Résumé is
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-blue-600 to-cyan-500">
              already a Website
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Drop your PDF. Get a shareable link. It takes less than a minute.
          </p>

          {/* Inline Upload Zone */}
          <div className="max-w-2xl mx-auto mb-8">
            <FileDropzone />
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Speed Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-orange-400 to-amber-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-linear-to-r from-orange-100 to-amber-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                        stroke="url(#speedGradient)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <defs>
                        <linearGradient
                          id="speedGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#F59E0B" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-amber-600 mb-2">
                    ~30s
                  </div>
                  <div className="text-slate-600 text-sm font-medium">
                    Average setup time
                  </div>
                </div>
              </div>
            </div>

            {/* AI Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-purple-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-linear-to-r from-indigo-100 to-purple-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="url(#aiGradient)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <defs>
                        <linearGradient
                          id="aiGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600 mb-2">
                    AI-Powered
                  </div>
                  <div className="text-slate-600 text-sm font-medium">
                    Smart parsing & formatting
                  </div>
                </div>
              </div>
            </div>

            {/* Free Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-emerald-400 to-teal-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="url(#freeGradient)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <defs>
                        <linearGradient
                          id="freeGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#14B8A6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-500 to-teal-600 mb-2">
                    Free
                  </div>
                  <div className="text-slate-600 text-sm font-medium">
                    Always free to create
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-600 text-sm font-medium">
            Built with Next.js • Powered by Cloudflare • Privacy-first design
          </p>
        </div>
      </footer>
    </div>
  );
}
