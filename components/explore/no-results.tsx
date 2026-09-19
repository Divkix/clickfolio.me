import Link from "next/link";

interface NoResultsProps {
  roleFilter: string;
}

export function NoResults({ roleFilter }: NoResultsProps) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border shadow-sm">
      <p className="text-muted-foreground text-lg">
        No professionals found.{" "}
        {roleFilter && (
          <Link href="/explore" className="text-brand hover:underline">
            Clear filters
          </Link>
        )}
      </p>
    </div>
  );
}
