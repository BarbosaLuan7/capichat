import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that returns a throttled version of the value that only updates at most once per interval.
 * Useful for expensive operations like scroll handlers.
 *
 * @param value - The value to throttle
 * @param limit - Minimum time between updates in milliseconds
 * @returns The throttled value
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(
      () => {
        if (Date.now() - lastRan.current >= limit) {
          setThrottledValue(value);
          lastRan.current = Date.now();
        }
      },
      limit - (Date.now() - lastRan.current)
    );

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * Hook that returns a throttled callback function.
 * The callback will be executed at most once per interval.
 *
 * @param callback - The callback function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns A throttled version of the callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const lastRan = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = limit - (now - lastRan.current);

      lastArgsRef.current = args;

      if (remaining <= 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        lastRan.current = now;
        callback(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastRan.current = Date.now();
          timeoutRef.current = null;
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current);
          }
        }, remaining);
      }
    },
    [callback, limit]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}
