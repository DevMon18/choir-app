import React from 'react';

export const RepertoireSkeleton = () => {
  return (
    <div className="py-6 px-4 pb-28 max-w-[1240px] mx-auto w-full flex flex-col gap-5">
      {/* Repertoire Header Banner Skeleton */}
      <div className="skeleton-glass-card flex justify-between items-center p-6 sm:px-7">
        <div className="flex flex-col gap-2">
          <div className="skeleton-text w-56 h-[26px]" />
          <div className="skeleton-text w-40 h-3.5" />
        </div>
        <div className="skeleton-pill w-[130px] h-[38px]" />
      </div>

      {/* Search & Category Filter Pills Skeleton */}
      <div className="skeleton-glass-card flex items-center justify-between gap-4 p-4 sm:px-5 flex-wrap">
        <div className="skeleton-pill w-60 h-10" />
        <div className="flex gap-2 overflow-x-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-pill w-[90px] h-8" />
          ))}
        </div>
      </div>

      {/* 3x3 Song Cards Grid Skeleton */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-glass-card flex flex-col justify-between gap-3.5 p-5 min-h-[150px]"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1.5 w-3/4">
                <div className="skeleton-text w-[90%] h-[18px]" />
                <div className="skeleton-text w-[55%] h-3" />
              </div>
              <div className="skeleton-circle w-8 h-8" />
            </div>

            <div className="flex items-center justify-between mt-auto">
              <div className="skeleton-pill w-[75px] h-[22px]" />
              <div className="skeleton-pill w-[85px] h-7" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
