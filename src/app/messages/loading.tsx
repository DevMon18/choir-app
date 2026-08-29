import React from 'react';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

export default function MessagesLoading() {
  return (
    <div className="py-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
      <TableSkeleton rows={5} />
    </div>
  );
}
