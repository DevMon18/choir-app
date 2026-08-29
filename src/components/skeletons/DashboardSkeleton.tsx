import React from 'react';

export const DashboardSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 max-w-[1240px] mx-auto w-full">
      {/* Hero Welcome Banner Skeleton */}
      <div className="skeleton-glass-card flex items-center justify-between p-6 sm:px-7 min-h-[110px]">
        <div className="flex items-center gap-4">
          <div className="skeleton-circle w-14 h-14" />
          <div className="flex flex-col gap-2">
            <div className="skeleton-text w-56 h-[22px]" />
            <div className="skeleton-text w-36 h-3.5" />
          </div>
        </div>
        <div className="skeleton-pill w-28 h-9" />
      </div>

      {/* 4 Stat Cards Grid Skeleton */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-glass-card flex items-center justify-between p-5 h-[110px]"
          >
            <div className="flex flex-col gap-2">
              <div className="skeleton-text w-20 h-3" />
              <div className="skeleton-text w-16 h-7" />
            </div>
            <div className="skeleton-circle w-11 h-11" />
          </div>
        ))}
      </div>

      {/* Content Columns Skeleton */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-5">
        <div className="skeleton-glass-card flex flex-col gap-4 min-h-[240px]">
          <div className="flex justify-between items-center">
            <div className="skeleton-text w-36 h-[18px]" />
            <div className="skeleton-pill w-[70px] h-6" />
          </div>
          <div className="skeleton-box h-[70px] w-full" />
          <div className="skeleton-box h-[70px] w-full" />
        </div>

        <div className="skeleton-glass-card flex flex-col gap-4 min-h-[240px]">
          <div className="flex justify-between items-center">
            <div className="skeleton-text w-40 h-[18px]" />
            <div className="skeleton-pill w-[70px] h-6" />
          </div>
          <div className="skeleton-box h-[70px] w-full" />
          <div className="skeleton-box h-[70px] w-full" />
        </div>
      </div>
    </div>
  );
};
