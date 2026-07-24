import React from 'react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

export default function MemberProfileLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <DashboardSkeleton />
    </div>
  );
}
