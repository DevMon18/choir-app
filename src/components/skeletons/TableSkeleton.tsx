import React from 'react';

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => {
  return (
    <div className="skeleton-glass-card p-6 max-w-[1240px] mx-auto w-full flex flex-col gap-5">
      {/* Header & Controls Skeleton */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="skeleton-text w-44 h-[22px]" />
          <div className="skeleton-text w-32 h-3" />
        </div>
        <div className="flex gap-2.5">
          <div className="skeleton-pill w-44 h-[38px]" />
          <div className="skeleton-pill w-28 h-[38px]" />
        </div>
      </div>

      {/* Table Rows Skeleton */}
      <div className="flex flex-col gap-2.5 mt-2">
        {Array.from({ length: rows }).map((_, i) => {
          // Vary text widths for an organic, non-static visual design
          const titleWidth = `${55 + (i * 7) % 30}%`;
          const badgeWidth = `${60 + (i * 13) % 25}px`;

          return (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 sm:px-4.5 rounded-xl bg-white/45 border border-black/5"
            >
              <div className="flex items-center gap-3.5 flex-[1_1_35%]">
                <div className="skeleton-circle w-10 h-10 shrink-0" />
                <div className="flex flex-col gap-1.5" style={{ width: titleWidth }}>
                  <div className="skeleton-text w-full h-3.5" />
                  <div className="skeleton-text w-3/5 h-2.5" />
                </div>
              </div>

              <div className="flex-[1_1_20%] flex justify-center">
                <div className="skeleton-pill h-[22px]" style={{ width: badgeWidth }} />
              </div>

              <div className="flex-[1_1_20%] flex justify-center">
                <div className="skeleton-text w-16 h-3" />
              </div>

              <div className="flex gap-2 justify-end flex-[0_0_100px]">
                <div className="skeleton-pill w-8 h-8" />
                <div className="skeleton-pill w-8 h-8" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
