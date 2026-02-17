export default function SettingsLoading() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
