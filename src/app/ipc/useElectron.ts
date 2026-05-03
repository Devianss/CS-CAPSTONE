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
    <T = unknown>(endpoint: string, payload?: unknown) =>
      python.call<T>(endpoint, payload),
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
