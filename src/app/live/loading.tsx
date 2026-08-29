import React from 'react';

export default function LiveLoading() {
  return (
    <div className="py-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
      {/* Top Live Session Bar skeleton */}
      <div className="glass-container h-[70px] rounded-2xl mb-5 bg-primary/5 animate-pulse" />
      {/* Live Lyrics Sheet Skeleton */}
      <div className="glass-container h-[420px] rounded-2xl bg-white/40 animate-pulse" />
    </div>
  );
}
