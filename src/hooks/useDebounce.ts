import { useEffect, useState } from 'react';

/**
 * Custom hook to debounce fast-changing values (e.g. search input fields).
 * Prevents heavy list filter calculations on every single keypress.
 *
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default 250ms)
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
