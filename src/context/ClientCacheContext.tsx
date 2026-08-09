'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  version: number;
}

interface ClientCacheContextType {
  getCachedData: <T>(key: string) => T | null;
  getCachedVersion: (key: string) => number;
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

  const getCachedVersion = useCallback((key: string): number => {
    return cacheRef.current.get(key)?.version ?? -1;
  }, []);

  const setCachedData = useCallback(<T,>(key: string, data: T) => {
    const existing = cacheRef.current.get(key);
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      version: (existing?.version ?? -1) + 1,
    });
  }, []);

  const invalidateCache = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return (
    <ClientCacheContext.Provider value={{ getCachedData, getCachedVersion, setCachedData, invalidateCache, clearCache }}>
      {children}
    </ClientCacheContext.Provider>
  );
};

const fallbackContext: ClientCacheContextType = {
  getCachedData: () => null,
  getCachedVersion: () => -1,
  setCachedData: () => {},
  invalidateCache: () => {},
  clearCache: () => {},
};

export const useClientCacheContext = () => {
  const ctx = useContext(ClientCacheContext);
  return ctx || fallbackContext;
};

/**
 * Facebook-style SWR hook for Instant 0ms Client Navigation.
 * Returns cached data immediately on revisit, while accepting fresh data from server.
 * ✅ FIX: Uses version counter instead of JSON.stringify for change detection —
 * avoids serializing entire datasets (songs, members) into strings on every render.
 */
export function useClientCache<T>(key: string, initialServerData: T): {
  data: T;
  updateData: (action: React.SetStateAction<T>) => void;
} {
  const { getCachedData, getCachedVersion, setCachedData } = useClientCacheContext();

  // Track the version of server data we last synced from
  const serverVersionRef = useRef<number>(-1);

  // Initialize state from client memory cache if present; fallback to initialServerData
  const [data, setData] = useState<T>(() => {
    const cached = getCachedData<T>(key);
    if (cached !== null) return cached;
    return initialServerData;
  });

  // Sync server data into cache when it changes, using version counters not JSON.stringify
  useEffect(() => {
    const cached = getCachedData<T>(key);
    const cachedVersion = getCachedVersion(key);

    if (cached === null) {
      // First mount — prime the cache
      setCachedData(key, initialServerData);
      serverVersionRef.current = getCachedVersion(key);
    } else if (cachedVersion !== serverVersionRef.current) {
      // Cache was updated externally (e.g. by another component or background revalidation)
      setCachedData(key, initialServerData);
      queueMicrotask(() => setData(initialServerData));
      serverVersionRef.current = getCachedVersion(key);
    }
  }, [key, initialServerData, getCachedData, getCachedVersion, setCachedData]);

  const updateData = useCallback(
    (action: React.SetStateAction<T>) => {
      setData((prev) => {
        const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
        setCachedData(key, next);
        serverVersionRef.current = getCachedVersion(key);
        return next;
      });
    },
    [key, setCachedData, getCachedVersion]
  );

  return { data, updateData };
}
