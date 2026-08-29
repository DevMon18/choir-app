import React from 'react';

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-screen p-4">
      {/* Top Header skeleton */}
      <div className="h-[60px] rounded-xl bg-white/50 mb-4 animate-pulse" />
      {/* Chat messages list skeleton */}
      <div className="flex-1 flex flex-col gap-3 justify-end">
        <div className="w-[60%] h-12 rounded-2xl bg-black/5 self-start animate-pulse" />
        <div className="w-[50%] h-12 rounded-2xl bg-primary/10 self-end animate-pulse" />
        <div className="w-[70%] h-12 rounded-2xl bg-black/5 self-start animate-pulse" />
      </div>
    </div>
  );
}
