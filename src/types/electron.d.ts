/**
 * electron.d.ts
 *
 * Adds `window.electronAPI` typings so the renderer gets IntelliSense.
 */

export type ElectronRole = "student" | "admin";

export type ElectronActorRole = ElectronRole | "system" | "agent";

export type ElectronRiskTier = "low" | "medium" | "high";

export type ElectronActionScope = "self" | "session" | "lab" | "system";

export type ElectronActionType =
  | "chat_response"
  | "audit_query"
  | "view_policy"
  | "health_check"
  | "recommend_action"
  | "draft_policy"
  | "mark_notification"
  | "wipe_terminal"
  | "lock_cluster"
  | "terminate_session"
  | "quarantine_usb"
  | "force_logout"
  | "enforce_blocklist";

export interface ElectronAgentAction {
  type: ElectronActionType;
  scope: ElectronActionScope;
  reversible: boolean;
  payload: Record<string, unknown>;
  confidence?: number;
  reasoning: string;
}

export interface ElectronApprovalEvidence {
  scanResult?: unknown;
  aiConfidence?: number;
  sourceAlert?: string;
}

export type ElectronApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "info_requested";

export interface ElectronApprovalDecision {
  decidedAt: number;
  decidedByUserId: string;
  comment?: string;
}

export interface ElectronApprovalComment {
  at: number;
  byUserId: string;
  text: string;
}

export interface ElectronApprovalRequest {
  id: string;
  createdAt: number;
  requesterId: string;
  requesterRole: ElectronRole;
  action: ElectronAgentAction;
  riskTier: "high";
  evidence?: ElectronApprovalEvidence;
  status: ElectronApprovalStatus;
  decision?: ElectronApprovalDecision;
  comments?: ElectronApprovalComment[];
}

export interface ElectronAuditRow {
  id: number;
  createdAt: number;
  eventType: string;
  actorUserId: string;
  actorRole: ElectronActorRole;
  detail: string;
  approvalId?: string;
  approverUserId?: string;
  riskTier?: ElectronRiskTier;
  confidenceScore?: number;
}

export type ElectronProposeResult =
  | {
      autoExecuted: true;
      tier: ElectronRiskTier;
      result: { ok: boolean; message: string };
    }
  | {
      autoExecuted: false;
      tier: "high";
      request: ElectronApprovalRequest;
    };

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
  audit: {
    log(args: {
      eventType: string;
      detail: string;
      actorUserId: string;
      actorRole: ElectronActorRole;
      approvalId?: string;
      approverUserId?: string;
      riskTier?: ElectronRiskTier;
      confidenceScore?: number;
    }): Promise<boolean>;
    list(limit?: number): Promise<ElectronAuditRow[]>;
  };
  agent: {
    propose(args: {
      action: ElectronAgentAction;
      requesterId: string;
      requesterRole: ElectronRole;
      evidence?: ElectronApprovalEvidence;
    }): Promise<ElectronProposeResult>;
    listPending(): Promise<ElectronApprovalRequest[]>;
    listHistory(limit?: number): Promise<ElectronApprovalRequest[]>;
    approve(args: {
      id: string;
      approverUserId: string;
      comment?: string;
    }): Promise<{ request: ElectronApprovalRequest; result: { ok: boolean; message: string } }>;
    reject(args: {
      id: string;
      approverUserId: string;
      comment?: string;
    }): Promise<ElectronApprovalRequest>;
    requestInfo(args: {
      id: string;
      byUserId: string;
      text: string;
    }): Promise<ElectronApprovalRequest>;
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
