import { Skeleton } from "@/components/ui/skeleton";

export default function WizardLoading() {
  return (
    <div className="min-h-screen bg-linear-to-br from-coral/10 via-coral/10 to-orange-50">
      {/* Progress Bar Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Progress Bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <Skeleton className="h-full w-1/4 rounded-full" />
          </div>
          {/* Step Indicators */}
          <div className="flex justify-between mt-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-16 hidden sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center">
          {/* Centered Wizard Card */}
          <div className="bg-card rounded-xl shadow-md border border-ink/10 p-8 w-full max-w-xl">
            {/* Card Header */}
            <div className="text-center mb-8">
              <Skeleton className="h-12 w-12 rounded-xl mx-auto mb-4" />
              <Skeleton className="h-8 w-64 mx-auto mb-2" />
              <Skeleton className="h-5 w-80 mx-auto" />
            </div>

            {/* Form Area */}
            <div className="space-y-6">
              {/* Input Field */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-3 w-48" />
              </div>

              {/* Secondary Input */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              {/* Action Button */}
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-ink/15">
              <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
