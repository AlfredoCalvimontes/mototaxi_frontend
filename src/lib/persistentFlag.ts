import { useCallback, useState } from 'react';

/**
 * A boolean the viewer toggles and expects to find as they left it — a hidden
 * column, say. Kept in `localStorage`, which can be unavailable (private
 * window, blocked site data) or throw, so every access is guarded and the flag
 * simply falls back to `initial` and lives for the session.
 */
export function usePersistentFlag(key: string, initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });

  const toggle = useCallback(() => {
    setValue((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // Not persisted; the flag still works for this session.
      }
      return next;
    });
  }, [key]);

  return [value, toggle];
}
