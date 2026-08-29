import React from 'react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

export default function DashboardLoading() {
  return (
    <div className="pt-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
      <DashboardSkeleton />
    </div>
  );
}
