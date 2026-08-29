import React from 'react';
import { CalendarSkeleton } from '@/components/skeletons/CalendarSkeleton';

export default function CalendarLoading() {
  return (
    <div className="py-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
      <CalendarSkeleton />
    </div>
  );
}
