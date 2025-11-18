import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FFFAF5] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <div className="text-8xl font-bold text-amber-600 mb-4">404</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Resume Not Found
          </h1>
          <p className="text-gray-600 text-lg">
            This resume doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Go to Homepage
          </Link>

          <p className="text-sm text-gray-500">
            Want to create your own resume?{' '}
            <Link href="/" className="text-amber-600 hover:text-amber-700">
              Get started
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
