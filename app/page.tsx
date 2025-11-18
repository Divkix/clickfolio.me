'use client'

import { useState } from 'react'
import { LoginButton } from '@/components/auth/LoginButton'
import { FileDropzone } from '@/components/FileDropzone'
import { Toaster } from '@/components/ui/sonner'

export default function Home() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-slate-900">
            webresume<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">.now</span>
          </div>
          <LoginButton />
        </div>
      </header>

      <main className="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight">
            Your Résumé is
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">
              already a Website
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Drop your PDF. Get a shareable link. It takes less than a minute.
          </p>

          {/* Upload Zone */}
          <div className="max-w-2xl mx-auto mb-8">
            <div
              onClick={() => setUploadModalOpen(true)}
              className="group relative bg-white rounded-2xl shadow-depth-md border border-slate-200/60 p-12 cursor-pointer transition-all duration-300 hover:shadow-depth-lg hover:-translate-y-1 backdrop-blur-sm overflow-hidden"
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center gap-4">
                {/* Icon with gradient background */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-r from-indigo-100 to-blue-100 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="w-12 h-12 text-transparent bg-clip-text"
                      style={{
                        fill: 'url(#uploadGradient)'
                      }}
                      viewBox="0 0 24 24"
                    >
                      <defs>
                        <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4F46E5" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        stroke="url(#uploadGradient)"
                        fill="none"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 mb-1">
                    Drop your PDF résumé here
                  </p>
                  <p className="text-sm text-slate-500">
                    or click to browse • Max 10MB
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500 mt-4 text-center">
              Upload anonymously. No account needed until you&apos;re ready to publish.
            </p>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Speed Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-gradient-to-r from-orange-100 to-amber-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="url(#speedGradient)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#F59E0B" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 mb-2">~30s</div>
                  <div className="text-slate-600 text-sm font-medium">Average setup time</div>
                </div>
              </div>
            </div>

            {/* AI Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-gradient-to-r from-indigo-100 to-purple-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="url(#aiGradient)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">AI-Powered</div>
                  <div className="text-slate-600 text-sm font-medium">Smart parsing & formatting</div>
                </div>
              </div>
            </div>

            {/* Free Card */}
            <div className="group bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-8 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-gradient-to-r from-emerald-100 to-teal-100 p-3 rounded-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="url(#freeGradient)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="freeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#14B8A6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600 mb-2">Free</div>
                  <div className="text-slate-600 text-sm font-medium">Always free to create</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-depth-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-600 text-sm font-medium">
            Built with Next.js • Powered by Cloudflare • Privacy-first design
          </p>
        </div>
      </footer>

      {/* FileDropzone Modal */}
      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  )
}
