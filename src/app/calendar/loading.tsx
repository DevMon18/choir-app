import React from 'react';
import { CalendarSkeleton } from '@/components/skeletons/CalendarSkeleton';

export default function CalendarLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <CalendarSkeleton />
    </div>
  );
}
