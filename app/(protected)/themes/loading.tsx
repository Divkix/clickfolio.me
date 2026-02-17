export default function ThemesLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
