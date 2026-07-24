import React from 'react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

export default function AdminAnalyticsLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <DashboardSkeleton />
    </div>
  );
}
