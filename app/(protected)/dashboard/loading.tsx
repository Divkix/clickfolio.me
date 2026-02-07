import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-cream">
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: Stats Cards - Full Width */}
          <div className="col-span-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Stat Card Skeletons */}
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl shadow-sm border border-ink/10 p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: Main Content Area */}
          {/* Left Column - Resume Preview (spans 2 on desktop) */}
          <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-ink/10 p-8">
            {/* Header */}
            <div className="mb-6">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>

            <div className="h-px bg-muted mb-6" />

            {/* Summary */}
            <div className="mb-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>

            <div className="h-px bg-muted mb-6" />

            {/* Footer - Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Skeleton className="h-10 flex-1 rounded-md" />
              <Skeleton className="h-10 flex-1 rounded-md" />
            </div>
          </div>

          {/* Right Column - Account Info */}
          <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>

              <div className="h-px bg-muted" />

              {/* Handle */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-8 w-24 mt-2 rounded-md" />
                </div>
              </div>

              <div className="h-px bg-muted" />

              {/* Member since */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
