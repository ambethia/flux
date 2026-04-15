import { useCallback, useState } from "react";

/**
 * Like useState but persists to sessionStorage under the given key.
 * Falls back to defaultValue if nothing stored or parsing fails.
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = sessionStorage.getItem(key);
    if (stored === null) return defaultValue;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      setState(value);
      sessionStorage.setItem(key, JSON.stringify(value));
    },
    [key],
  );

  return [state, setValue];
}
