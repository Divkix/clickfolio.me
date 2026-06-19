import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 404 page shown when a requested resume handle does not exist.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
          <div className="mb-8">
            <div className="text-8xl font-bold mb-4 text-muted-foreground/50">404</div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Resume Not Found</h1>
            <p className="text-muted-foreground text-lg">
              This resume doesn&apos;t exist or hasn&apos;t been published yet.
            </p>
          </div>

          <div className="space-y-4">
            <Button asChild size="lg">
              <Link href="/">Go to Homepage</Link>
            </Button>

            <p className="text-sm text-muted-foreground">
              Want to create your own resume?{" "}
              <Link
                href="/"
                className="text-brand hover:text-brand-active font-medium transition-colors"
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
