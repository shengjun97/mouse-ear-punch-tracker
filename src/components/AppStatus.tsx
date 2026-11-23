import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLocalPref } from '../hooks/useLocalPref';

/** Banner when a new version is installed, and a one-time "ready offline" note. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const t = window.setTimeout(() => setOfflineReady(false), 6000);
    return () => window.clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh)
    return (
      <div className="app-banner" role="status">
        <span>A new version of the app is ready. Your data is not affected.</span>
        <div className="row-actions">
          <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>
            Reload now
          </button>
          <button type="button" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      </div>
    );
  if (offlineReady)
    return (
      <div className="app-banner" role="status">
        <span>Ready to work offline. You can use the app with no network.</span>
        <button type="button" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    );
  return null;
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Shown in the header with no network. The app works the same offline. */
export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <span className="offline-badge" role="status" title="No network. Everything still works; data is saved on this device.">
      Offline
    </span>
  );
}

export type ThemePref = 'system' | 'light' | 'dark';
const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePref, string> = { system: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };

/** Cycles automatic (follows the device), light, and dark themes. */
export function ThemeToggle() {
  const [theme, setTheme] = useLocalPref<ThemePref>('theme', 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  return (
    <button type="button" className="theme-toggle" onClick={() => setTheme(NEXT[theme])} aria-label={`${LABEL[theme]}. Change theme`}>
      {LABEL[theme]}
    </button>
  );
}

/**
 * Ask the browser not to evict this site's storage. Chrome and Edge decide
 * silently; Firefox may ask the user. Safe to call repeatedly.
 */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  try {
    if (!navigator.storage?.persist) return undefined;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}

export async function storageStatus(): Promise<{ persisted?: boolean; usage?: number; quota?: number }> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : undefined;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
    return { persisted, usage: est?.usage, quota: est?.quota };
  } catch {
    return {};
  }
}
