/**
 * useElectron.ts
 *
 * React hook that wraps window.electronAPI.
 * Falls back gracefully when running in a plain browser (dev/test).
 *
 * Usage:
 *   const { session, settings, window: win } = useElectron();
 *   await session.clear();
 */
import { useCallback } from "react";

const isElectron = (): boolean =>
  typeof window !== "undefined" && !!window.electronAPI;

// ── Stubs for browser-only development ─────────────────────────────────────
const noop = () => {};
const asyncNoop = async () => {};

const browserStubs: ElectronAPI = {
  session: {
    get: async () => null,
    set: async () => true,
    clear: async () => true,
  },
  settings: {
    get: async () => ({ kioskMode: false, theme: "dark", notifications: true }),
    set: async (p) => ({ kioskMode: false, theme: "dark", notifications: true, ...p }),
  },
  window: {
    minimize: noop,
    maximize: noop,
    close: noop,
  },
  python: {
    call: async () => ({ ok: false, error: "Not in Electron" }),
  },
  dialog: {
    openFile: async () => null,
  },
  tray: {
    notify: noop,
  },
  app: {
    version: async () => "0.0.0-browser",
    platform: async () => "browser",
  },
  on: noop,
  off: noop,
};

export function useElectron(): ElectronAPI {
  return isElectron() ? window.electronAPI : browserStubs;
}

// ── Convenience hooks ───────────────────────────────────────────────────────

/** Call a Python microservice endpoint */
export function usePython() {
  const { python } = useElectron();

  const call = useCallback(
    <T = unknown>(endpoint: string, payload?: unknown) =>
      python.call<T>(endpoint, payload),
    [python]
  );

  return { call };
}

/** Control the custom titlebar */
export function useWindowControls() {
  const { window: win } = useElectron();
  return {
    minimize: win.minimize,
    maximize: win.maximize,
    close: win.close,
  };
}
