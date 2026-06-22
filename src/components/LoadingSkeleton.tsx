export function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800" />
      </div>
      <div className="h-8 w-24 bg-slate-800 rounded-lg mb-2" />
      <div className="h-4 w-16 bg-slate-800 rounded-lg" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="border-b border-slate-800 px-6 py-3 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 w-20 bg-slate-800 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-slate-800/50 px-6 py-4 flex gap-4 items-center">
          <div className="w-8 h-8 rounded-full bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-slate-800 rounded" />
            <div className="h-3 w-20 bg-slate-800 rounded" />
          </div>
          <div className="h-6 w-16 bg-slate-800 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-slate-800 rounded" />
              <div className="h-3 w-28 bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-16 bg-slate-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Banner skeleton */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-24" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="h-6 w-40 bg-slate-800 rounded-lg mb-6" />
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-4 h-20" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-slate-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 bg-slate-700 rounded" />
                  <div className="h-3 w-16 bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="h-6 w-32 bg-slate-800 rounded-lg mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-28 bg-slate-700 rounded" />
                  <div className="h-3 w-20 bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline skeleton */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="h-6 w-36 bg-slate-800 rounded-lg mb-6" />
        <div className="flex gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="min-w-[140px] bg-slate-800/50 rounded-xl p-3 h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}