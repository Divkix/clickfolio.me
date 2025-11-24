import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md">
        <div className="bg-white rounded-2xl shadow-depth-md border border-slate-200/60 p-8 text-center hover:-translate-y-0.5 transition-all duration-300">
          <div className="mb-8">
            <div className="text-8xl font-extrabold mb-4 text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-blue-600">
              404
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Page Not Found</h1>
            <p className="text-slate-600 text-lg">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-blue-700 shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
