/**
 * preload.ts
 *
 * Runs in the renderer context but with access to Node/Electron APIs.
 * Exposes a typed, safe API surface via contextBridge so the React app
 * never touches raw IPC or Node directly.
 */
import { contextBridge, ipcRenderer } from "electron";

// ─────────────────────────────────────────────
//  Types (shared with renderer via @/types/electron.d.ts)
// ─────────────────────────────────────────────
type Role = "student" | "admin";

interface SessionPayload {
  userId: string;
  role: Role;
  token: string;
  persistent: boolean;
  expiresAt: number;
}

interface AppSettings {
  kioskMode: boolean;
  theme: "dark" | "light";
  notifications: boolean;
}

interface PythonResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────
//  Exposed API — window.electronAPI
// ─────────────────────────────────────────────
const api = {
  // Session
  session: {
    get: (): Promise<SessionPayload | null> =>
      ipcRenderer.invoke("session:get"),
    set: (payload: SessionPayload): Promise<boolean> =>
      ipcRenderer.invoke("session:set", payload),
    clear: (): Promise<boolean> => ipcRenderer.invoke("session:clear"),
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke("settings:set", partial),
  },

  // Window controls (custom titlebar)
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },

  // Python microservice
  python: {
    call: <T = unknown>(
      endpoint: string,
      payload?: unknown
    ): Promise<PythonResult<T>> =>
      ipcRenderer.invoke("python:call", endpoint, payload),
  },

  // File dialog
  dialog: {
    openFile: (
      filters?: { name: string; extensions: string[] }[]
    ): Promise<string | null> =>
      ipcRenderer.invoke("dialog:openFile", filters),
  },

  // Tray notifications
  tray: {
    notify: (title: string, body: string): void => {
      ipcRenderer.invoke("tray:notify", title, body);
    },
  },

  // App info
  app: {
    version: (): Promise<string> => ipcRenderer.invoke("app:version"),
    platform: (): Promise<string> => ipcRenderer.invoke("app:platform"),
  },

  // Listen for main → renderer events (e.g., navigate, notifications)
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const validChannels = ["navigate", "notification:push", "usb:event"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    }
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

// TypeScript declaration merged in src/types/electron.d.ts
