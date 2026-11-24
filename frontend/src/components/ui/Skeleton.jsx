import React from "react";

export function SkeletonBlock({ className = "h-6 w-full" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-stone-800/70 via-stone-700/40 to-stone-800/70 ${className}`}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="h-10 w-3/4" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
          <div className="lg:col-span-5">
            <SkeletonBlock className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="glass-card rounded-2xl p-4 space-y-3">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-8 w-24" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <SkeletonBlock className="h-72 w-full" />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <SkeletonBlock className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
