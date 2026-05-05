/**
 * preload.ts
 *
 * Runs in the renderer context but with access to Node/Electron APIs.
 * Exposes a typed, safe API surface via contextBridge.
 */
import { contextBridge, ipcRenderer } from "electron";

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

type ActorRole = Role | "system" | "agent";

type RiskTier = "low" | "medium" | "high";

interface AgentActionPayload {
  type: string;
  scope: string;
  reversible: boolean;
  payload: Record<string, unknown>;
  confidence?: number;
  reasoning: string;
}

interface ApprovalEvidencePayload {
  scanResult?: unknown;
  aiConfidence?: number;
  sourceAlert?: string;
}

const api = {
  session: {
    get: (): Promise<SessionPayload | null> =>
      ipcRenderer.invoke("session:get"),
    set: (payload: SessionPayload): Promise<boolean> =>
      ipcRenderer.invoke("session:set", payload),
    clear: (): Promise<boolean> => ipcRenderer.invoke("session:clear"),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke("settings:set", partial),
  },

  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },

  python: {
    call: <T = unknown>(
      endpoint: string,
      payload?: unknown,
      options?: { method?: "GET" | "POST"; timeoutMs?: number },
    ): Promise<PythonResult<T>> =>
      ipcRenderer.invoke("python:call", endpoint, payload ?? null, options ?? null),
  },

  dialog: {
    openFile: (
      filters?: { name: string; extensions: string[] }[],
    ): Promise<string | null> =>
      ipcRenderer.invoke("dialog:openFile", filters),
  },

  lab: {
    getShortcuts: (): Promise<
      Array<{ id: string; label: string; targetPath: string }>
    > => ipcRenderer.invoke("lab:get-shortcuts"),
    addShortcut: (payload: {
      label: string;
      targetPath: string;
    }): Promise<
      | { ok: true; shortcuts: Array<{ id: string; label: string; targetPath: string }>; item: { id: string; label: string; targetPath: string } }
      | { ok: false; shortcuts: Array<{ id: string; label: string; targetPath: string }>; error: string }
    > => ipcRenderer.invoke("lab:add-shortcut", payload),
    updateShortcut: (payload: {
      id: string;
      label: string;
      targetPath: string;
    }): Promise<
      | { ok: true; shortcuts: Array<{ id: string; label: string; targetPath: string }>; item: { id: string; label: string; targetPath: string } }
      | { ok: false; shortcuts: Array<{ id: string; label: string; targetPath: string }>; error: string }
    > => ipcRenderer.invoke("lab:update-shortcut", payload),
    removeShortcut: (
      id: string,
    ): Promise<
      | { ok: true; shortcuts: Array<{ id: string; label: string; targetPath: string }> }
      | { ok: false; shortcuts: Array<{ id: string; label: string; targetPath: string }>; error: string }
    > => ipcRenderer.invoke("lab:remove-shortcut", id),
    launch: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("lab:launch", id),
  },

  runaFiles: {
    getVaultRoot: (): Promise<{ ok: boolean; path: string | null; error?: string }> =>
      ipcRenderer.invoke("runaFiles:getVaultRoot"),
    getSessionWorkspaceRelative: (): Promise<{
      ok: boolean;
      relative: string | null;
      error?: string;
    }> => ipcRenderer.invoke("runaFiles:getSessionWorkspaceRelative"),
    createFolder: (
      relativePath: string,
    ): Promise<{ ok: boolean; error?: string; absolute?: string }> =>
      ipcRenderer.invoke("runaFiles:createFolder", relativePath),
    writeTextFile: (
      relativePath: string,
      content: string,
    ): Promise<{ ok: boolean; error?: string; absolute?: string }> =>
      ipcRenderer.invoke("runaFiles:writeTextFile", relativePath, content),
    listDir: (
      relativePath: string,
    ): Promise<{ ok: boolean; entries: string[]; error?: string }> =>
      ipcRenderer.invoke("runaFiles:listDir", relativePath),
  },

  telemetry: {
    record: (event: string, meta?: Record<string, unknown>): Promise<boolean> =>
      ipcRenderer.invoke("telemetry:record", event, meta ?? {}),
  },

  tray: {
    notify: (title: string, body: string): void => {
      ipcRenderer.invoke("tray:notify", title, body);
    },
  },

  app: {
    version: (): Promise<string> => ipcRenderer.invoke("app:version"),
    platform: (): Promise<string> => ipcRenderer.invoke("app:platform"),
  },

  audit: {
    log: (args: {
      eventType: string;
      detail: string;
      actorUserId: string;
      actorRole: ActorRole;
      approvalId?: string;
      approverUserId?: string;
      riskTier?: RiskTier;
      confidenceScore?: number;
    }): Promise<boolean> => ipcRenderer.invoke("audit:log", args),
    list: (limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke("audit:list", limit),
  },

  agent: {
    propose: (args: {
      action: AgentActionPayload;
      requesterId: string;
      requesterRole: Role;
      evidence?: ApprovalEvidencePayload;
    }): Promise<unknown> => ipcRenderer.invoke("agent:propose", args),
    listPending: (): Promise<unknown[]> =>
      ipcRenderer.invoke("agent:list-pending"),
    listHistory: (limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke("agent:list-history", limit),
    approve: (args: {
      id: string;
      approverUserId: string;
      comment?: string;
    }): Promise<unknown> => ipcRenderer.invoke("agent:approve", args),
    reject: (args: {
      id: string;
      approverUserId: string;
      comment?: string;
    }): Promise<unknown> => ipcRenderer.invoke("agent:reject", args),
    requestInfo: (args: {
      id: string;
      byUserId: string;
      text: string;
    }): Promise<unknown> => ipcRenderer.invoke("agent:request-info", args),
  },

  security: {
    listBlockedDomains: (): Promise<string[]> =>
      ipcRenderer.invoke("security:list-blocked-domains"),
    checkUrl: (
      url: string,
    ): Promise<{ ok: boolean; blocked: boolean; domain: string; reason: "policy_blocked" | "allowed" | "invalid_url" }> =>
      ipcRenderer.invoke("security:check-url", url),
  },

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
