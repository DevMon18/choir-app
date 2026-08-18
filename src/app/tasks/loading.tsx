import React from 'react';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

export default function TasksLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      <TableSkeleton rows={4} />
    </div>
  );
}
