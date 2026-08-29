import React from 'react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

export default function AdminAnalyticsLoading() {
  return (
    <div className="py-6 px-4 pb-[120px] max-w-[1000px] mx-auto w-full">
      <DashboardSkeleton />
    </div>
  );
}
