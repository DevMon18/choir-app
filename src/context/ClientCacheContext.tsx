'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
}

interface ClientCacheContextType {
  getCachedData: <T>(key: string) => T | null;
  setCachedData: <T>(key: string, data: T) => void;
  invalidateCache: (key: string) => void;
  clearCache: () => void;
}

const ClientCacheContext = createContext<ClientCacheContextType | null>(null);

export const ClientCacheProvider = ({ children }: { children: React.ReactNode }) => {
  const cacheRef = useRef<Map<string, CacheItem>>(new Map());

  const getCachedData = useCallback(<T,>(key: string): T | null => {
    const item = cacheRef.current.get(key);
    if (!item) return null;
    return item.data as T;
  }, []);

  const setCachedData = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const invalidateCache = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return (
    <ClientCacheContext.Provider value={{ getCachedData, setCachedData, invalidateCache, clearCache }}>
      {children}
    </ClientCacheContext.Provider>
  );
};

export const useClientCacheContext = () => {
  const ctx = useContext(ClientCacheContext);
  if (!ctx) {
    throw new Error('useClientCacheContext must be used within a ClientCacheProvider');
  }
  return ctx;
};

/**
 * Facebook-style SWR hook for Instant 0ms Client Navigation
 * Returns cached data immediately on revisit, while accepting incoming fresh data from server
 */
export function useClientCache<T>(key: string, initialServerData: T): {
  data: T;
  updateData: (action: React.SetStateAction<T>) => void;
} {
  const { getCachedData, setCachedData } = useClientCacheContext();

  // Initialize state from client memory cache if present; fallback to initialServerData
  const [data, setData] = useState<T>(() => {
    const cached = getCachedData<T>(key);
    if (cached !== null) return cached;
    return initialServerData;
  });

  // Save server data or initial data into cache on mount or when server payload changes
  useEffect(() => {
    const cached = getCachedData<T>(key);
    if (!cached) {
      setCachedData(key, initialServerData);
      setData(initialServerData);
    } else if (JSON.stringify(cached) !== JSON.stringify(initialServerData)) {
      // Sync background revalidation from server seamlessly
      setCachedData(key, initialServerData);
      setData(initialServerData);
    }
  }, [key, initialServerData, getCachedData, setCachedData]);

  const updateData = useCallback(
    (action: React.SetStateAction<T>) => {
      setData((prev) => {
        const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
        setCachedData(key, next);
        return next;
      });
    },
    [key, setCachedData]
  );

  return { data, updateData };
}
