/**
 * electron.d.ts
 *
 * Adds `window.electronAPI` typings so every React component gets
 * full IntelliSense without importing anything.
 *
 * Place this file at: src/types/electron.d.ts
 */

type ElectronRole = "student" | "admin";

interface ElectronSession {
  userId: string;
  role: ElectronRole;
  token: string;
  persistent: boolean;
  expiresAt: number;
}

interface ElectronSettings {
  kioskMode: boolean;
  theme: "dark" | "light";
  notifications: boolean;
}

interface PythonResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface ElectronAPI {
  session: {
    get(): Promise<ElectronSession | null>;
    set(payload: ElectronSession): Promise<boolean>;
    clear(): Promise<boolean>;
  };
  settings: {
    get(): Promise<ElectronSettings>;
    set(partial: Partial<ElectronSettings>): Promise<ElectronSettings>;
  };
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };
  python: {
    call<T = unknown>(endpoint: string, payload?: unknown): Promise<PythonResult<T>>;
  };
  dialog: {
    openFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>;
  };
  tray: {
    notify(title: string, body: string): void;
  };
  app: {
    version(): Promise<string>;
    platform(): Promise<string>;
  };
  on(channel: string, listener: (...args: unknown[]) => void): void;
  off(channel: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
