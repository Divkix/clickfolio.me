import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

interface ExplorePaginationProps {
  currentPage: number;
  totalPages: number;
  roleFilter: string;
}

export function ExplorePagination({ currentPage, totalPages, roleFilter }: ExplorePaginationProps) {
  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Button asChild variant="outline" size="sm">
          <Link to="/explore" search={{ page: currentPage - 1, role: roleFilter || undefined }}>
            Previous
          </Link>
        </Button>
      )}

      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
          .map((page, index, arr) => {
            const showEllipsis = index > 0 && page - arr[index - 1] > 1;

            return (
              <span key={page} className="contents">
                {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                <Button asChild variant={page === currentPage ? "default" : "outline"} size="icon">
                  <Link
                    to="/explore"
                    search={{ page, role: roleFilter || undefined }}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Link>
                </Button>
              </span>
            );
          })}
      </div>

      {currentPage < totalPages && (
        <Button asChild variant="outline" size="sm">
          <Link to="/explore" search={{ page: currentPage + 1, role: roleFilter || undefined }}>
            Next
          </Link>
        </Button>
      )}
    </div>
  );
}
