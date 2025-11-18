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

          {/* Upload Button */}
          <div className="max-w-2xl mx-auto mb-8">
            <div
              onClick={() => setUploadModalOpen(true)}
              className="border-2 border-dashed border-amber-300 rounded-2xl bg-white/80 p-12 hover:border-amber-400 transition-all hover:shadow-lg cursor-pointer"
            >
              <div className="flex flex-col items-center gap-4">
                <svg
                  className="w-16 h-16 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    Drop your PDF résumé here
                  </p>
                  <p className="text-sm text-gray-500">
                    or click to browse • Max 10MB
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Upload anonymously. No account needed until you&apos;re ready to publish.
            </p>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-20 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-amber-600 mb-2">~30s</div>
              <div className="text-gray-600">Average setup time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-600 mb-2">AI-Powered</div>
              <div className="text-gray-600">Smart parsing & formatting</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-600 mb-2">Free</div>
              <div className="text-gray-600">Always free to create</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600 text-sm">
            Built with Next.js • Powered by Cloudflare • Privacy-first design
          </p>
        </div>
      </footer>

      {/* FileDropzone Modal */}
      <FileDropzone open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  )
}
