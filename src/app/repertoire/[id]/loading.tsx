import React from 'react';

export default function SongDetailLoading() {
  return (
    <div className="pt-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
      {/* Song title banner skeleton */}
      <div className="glass-container h-[120px] !rounded-2xl mb-5 !bg-primary/5 animate-pulse" />
      {/* Lyrics body skeleton */}
      <div className="glass-container h-[400px] !rounded-2xl !bg-white/40 animate-pulse" />
    </div>
  );
}
