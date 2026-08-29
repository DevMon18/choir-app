import React from 'react';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

export default function AdminDocumentsLoading() {
  return (
    <div className="py-6 px-4 pb-[120px] max-w-[1100px] mx-auto w-full">
      <TableSkeleton rows={5} />
    </div>
  );
}
