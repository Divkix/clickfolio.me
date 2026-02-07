import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream paper-texture flex items-center justify-center px-6">
      <div className="max-w-md">
        <div className="bg-cream border-3 border-ink shadow-brutal-lg p-8 text-center hover:-translate-y-1 transition-all duration-300">
          <div className="mb-8">
            <div className="text-8xl font-extrabold mb-4 text-muted-foreground/50">404</div>
            <h1 className="text-3xl font-bold text-ink mb-2">Resume Not Found</h1>
            <p className="text-ink/70 text-lg">
              This resume doesn&apos;t exist or hasn&apos;t been published yet.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-ink text-cream font-semibold shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 transition-all duration-300"
            >
              Go to Homepage
            </Link>

            <p className="text-sm text-ink/60">
              Want to create your own resume?{" "}
              <Link
                href="/"
                className="text-ink hover:text-ink/80 font-medium transition-all duration-300"
              >
                Get started
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
