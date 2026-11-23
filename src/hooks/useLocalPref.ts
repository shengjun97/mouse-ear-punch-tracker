import { useState } from 'react';

/**
 * A small per-device view preference (e.g. card size). Falls back to the
 * default when storage is unavailable. Never used for experiment data.
 */
export function useLocalPref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  };
  return [value, set] as const;
}
