'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { recordDuesPayment } from '@/app/admin/finances/actions';
import { PaymentMethod } from '@/lib/financeUtils';

export interface QueuedCollectionItem {
  client_operation_id: string;
  member_id: string;
  period_label: string;
  amount_centavos: number;
  method: PaymentMethod;
  reference?: string;
  paid_at: string;
  member_name: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message?: string;
  created_at: string;
}

const STORAGE_KEY = 'choir_sunday_collection_offline_queue_v1';

export function useOfflineCollectionQueue(onSyncSuccess?: () => void) {
  const [queue, setQueue] = useState<QueuedCollectionItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: QueuedCollectionItem[] = JSON.parse(stored);
        setQueue(parsed);
      }
    } catch (err) {
      console.warn('Failed to load offline collection queue:', err);
    }
  }, []);

  // Save queue to localStorage
  const saveQueue = useCallback((items: QueuedCollectionItem[]) => {
    setQueue(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save offline collection queue to localStorage:', err);
    }
  }, []);

  // Queue an item
  const enqueuePayment = useCallback(
    (item: Omit<QueuedCollectionItem, 'client_operation_id' | 'status' | 'created_at'>) => {
      const client_operation_id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newItem: QueuedCollectionItem = {
        ...item,
        client_operation_id,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setQueue((prev) => {
        const updated = [...prev, newItem];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      return client_operation_id;
    },
    []
  );

  // Sync pending items
  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    // Read latest from localStorage
    let currentQueue: QueuedCollectionItem[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      currentQueue = stored ? JSON.parse(stored) : [];
    } catch {
      currentQueue = queue;
    }

    const pendingItems = currentQueue.filter((i) => i.status === 'pending' || i.status === 'failed');
    if (pendingItems.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    let hasSuccessfulSync = false;
    let updatedQueue = [...currentQueue];

    for (const item of pendingItems) {
      // Mark as syncing
      updatedQueue = updatedQueue.map((q) =>
        q.client_operation_id === item.client_operation_id ? { ...q, status: 'syncing' } : q
      );
      saveQueue(updatedQueue);

      try {
        const res = await recordDuesPayment({
          memberId: item.member_id,
          periodLabel: item.period_label,
          amountCentavos: item.amount_centavos,
          method: item.method,
          reference: item.reference,
          paidAt: item.paid_at,
          clientOperationId: item.client_operation_id,
        });

        if (res?.error) {
          updatedQueue = updatedQueue.map((q) =>
            q.client_operation_id === item.client_operation_id
              ? { ...q, status: 'failed', error_message: res.error }
              : q
          );
        } else {
          hasSuccessfulSync = true;
          updatedQueue = updatedQueue.map((q) =>
            q.client_operation_id === item.client_operation_id ? { ...q, status: 'synced' } : q
          );
        }
      } catch (err: any) {
        updatedQueue = updatedQueue.map((q) =>
          q.client_operation_id === item.client_operation_id
            ? { ...q, status: 'failed', error_message: err.message || 'Network error' }
            : q
        );
      }
      saveQueue(updatedQueue);
    }

    // Clean up synced items older than 1 hour or keep latest
    const cleaned = updatedQueue.filter((i) => i.status !== 'synced');
    saveQueue(cleaned);

    isSyncingRef.current = false;
    setIsSyncing(false);

    if (hasSuccessfulSync && onSyncSuccess) {
      onSyncSuccess();
    }
  }, [queue, saveQueue, onSyncSuccess]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // Clear all failed / old synced items
  const clearSyncedItems = useCallback(() => {
    const remaining = queue.filter((q) => q.status === 'pending' || q.status === 'syncing');
    saveQueue(remaining);
  }, [queue, saveQueue]);

  const pendingCount = queue.filter((i) => i.status === 'pending' || i.status === 'syncing').length;
  const failedCount = queue.filter((i) => i.status === 'failed').length;

  return {
    queue,
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    enqueuePayment,
    syncQueue,
    clearSyncedItems,
  };
}
