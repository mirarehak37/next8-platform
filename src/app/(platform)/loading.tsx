// Shown instantly while a page's server data loads; sidebar and top bar stay in place.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Načítám…">
      <div className="border-b px-4 pt-1 pb-4 sm:px-6">
        <div className="mb-2.5 h-3 w-24 animate-pulse rounded bg-white/6" />
        <div className="h-4 w-48 animate-pulse rounded bg-white/8" />
        <div className="mt-2.5 h-3 w-72 max-w-full animate-pulse rounded bg-white/5" />
      </div>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-lg bg-card outline-1 -outline-offset-1 outline-white/6" />
          ))}
        </div>
        <div className="h-[320px] animate-pulse rounded-lg bg-card outline-1 -outline-offset-1 outline-white/6" />
      </div>
    </div>
  );
}
