/**
 * useElectron.ts
 *
 * React hook that wraps window.electronAPI.
 * Falls back gracefully when running in a plain browser (dev/test).
 */
import { useCallback } from "react";

const isElectron = (): boolean =>
  typeof window !== "undefined" && !!window.electronAPI;

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
    call: async <T = unknown>(
      _endpoint: string,
      _payload?: unknown,
      _options?: { method?: "GET" | "POST"; timeoutMs?: number },
    ): Promise<PythonResult<T>> => ({ ok: false, error: "Not in Electron" }),
  },
  dialog: {
    openFile: async () => null,
  },
  lab: {
    getShortcuts: async () => [],
    addShortcut: async () => ({
      ok: false as const,
      shortcuts: [],
      error: "Not in Electron",
    }),
    updateShortcut: async () => ({
      ok: false as const,
      shortcuts: [],
      error: "Not in Electron",
    }),
    removeShortcut: async () => ({
      ok: false as const,
      shortcuts: [],
      error: "Not in Electron",
    }),
    launch: async () => ({ ok: false, error: "Not in Electron" }),
  },
  runaFiles: {
    getVaultRoot: async () => ({ ok: false, path: null, error: "Not in Electron" }),
    getSessionWorkspaceRelative: async () => ({
      ok: false,
      relative: null,
      error: "Not in Electron",
    }),
    createFolder: async () => ({ ok: false, error: "Not in Electron" }),
    writeTextFile: async () => ({ ok: false, error: "Not in Electron" }),
    listDir: async () => ({ ok: false, entries: [], error: "Not in Electron" }),
  },
  telemetry: {
    record: async () => true,
  },
  tray: {
    notify: noop,
  },
  app: {
    version: async () => "0.0.0-browser",
    platform: async () => "browser",
  },
  audit: {
    log: async () => true,
    list: async () => [],
  },
  agent: {
    propose: async () => ({
      autoExecuted: true,
      tier: "low" as const,
      result: { ok: true, message: "Browser stub" },
    }),
    listPending: async () => [],
    listHistory: async () => [],
    approve: async (args) => ({
      request: {
        id: args.id,
        createdAt: Date.now(),
        requesterId: "stub",
        requesterRole: "admin",
        action: {
          type: "wipe_terminal",
          scope: "lab",
          reversible: false,
          payload: {},
          reasoning: "stub",
        },
        riskTier: "high",
        status: "approved",
      },
      result: { ok: true, message: "Browser stub" },
    }),
    reject: async (args) => ({
      id: args.id,
      createdAt: Date.now(),
      requesterId: "stub",
      requesterRole: "admin",
      action: {
        type: "wipe_terminal",
        scope: "lab",
        reversible: false,
        payload: {},
        reasoning: "stub",
      },
      riskTier: "high",
      status: "rejected",
    }),
    requestInfo: async (args) => ({
      id: args.id,
      createdAt: Date.now(),
      requesterId: "stub",
      requesterRole: "admin",
      action: {
        type: "wipe_terminal",
        scope: "lab",
        reversible: false,
        payload: {},
        reasoning: "stub",
      },
      riskTier: "high",
      status: "info_requested",
      comments: [{ at: Date.now(), byUserId: args.byUserId, text: args.text }],
    }),
  },
  on: noop,
  off: noop,
};

export function useElectron(): ElectronAPI {
  return isElectron() ? window.electronAPI : browserStubs;
}

export function usePython() {
  const { python } = useElectron();

  const call = useCallback(
    <T = unknown>(
      endpoint: string,
      payload?: unknown,
      options?: { method?: "GET" | "POST"; timeoutMs?: number },
    ) => python.call<T>(endpoint, payload, options),
    [python],
  );

  return { call };
}

export function useWindowControls() {
  const { window: win } = useElectron();
  return {
    minimize: win.minimize,
    maximize: win.maximize,
    close: win.close,
  };
}
