import React from 'react';

export const CalendarSkeleton = () => {
  return (
    <div className="skeleton-glass-card p-6 max-w-[1240px] mx-auto w-full flex flex-col gap-5">
      {/* Calendar Header Controls Skeleton */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="skeleton-text w-40 h-[26px]" />
          <div className="flex gap-1">
            <div className="skeleton-pill w-8 h-8" />
            <div className="skeleton-pill w-8 h-8" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton-pill w-[90px] h-9" />
          <div className="skeleton-pill w-[130px] h-9" />
        </div>
      </div>

      {/* Days of week headers */}
      <div className="grid grid-cols-7 gap-2 text-center">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
          <div
            key={day}
            className="p-2 text-xs font-bold text-muted"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Grid Skeleton */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => {
          const hasEvent = i % 5 === 1 || i % 7 === 3 || i === 14 || i === 22;
          return (
            <div
              key={i}
              className="h-[85px] rounded-xl bg-white/45 border border-black/5 p-2 flex flex-col justify-between"
            >
              <div className="skeleton-text w-[18px] h-3" />
              {hasEvent && (
                <div className="skeleton-pill w-full h-5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
