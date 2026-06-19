import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Generic 404 page for unmatched routes.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
          <div className="mb-8">
            <div className="text-8xl font-bold mb-4 text-muted-foreground/50">404</div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Page Not Found</h1>
            <p className="text-muted-foreground text-lg">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>

          <Button asChild size="lg">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
