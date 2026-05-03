import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
} from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
const Store = require("electron-store");
import fs from "fs";

// ─────────────────────────────────────────────
//  Types (mirror src/app/agentic/types.ts — main stays self-contained)
// ─────────────────────────────────────────────
type RiskTier = "low" | "medium" | "high";
type Role = "student" | "admin";
type ActorRole = "student" | "admin" | "system" | "agent";

type ActionType =
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

interface AgentAction {
  type: ActionType;
  scope: "self" | "session" | "lab" | "system";
  reversible: boolean;
  payload: Record<string, unknown>;
  confidence?: number;
  reasoning: string;
}

type ApprovalStatus = "pending" | "approved" | "rejected" | "info_requested";

interface ApprovalDecision {
  decidedAt: number;
  decidedByUserId: string;
  comment?: string;
}

interface ApprovalComment {
  at: number;
  byUserId: string;
  text: string;
}

interface ApprovalEvidence {
  scanResult?: unknown;
  aiConfidence?: number;
  sourceAlert?: string;
}

interface ApprovalRequest {
  id: string;
  createdAt: number;
  requesterId: string;
  requesterRole: Role;
  action: AgentAction;
  riskTier: "high";
  evidence?: ApprovalEvidence;
  status: ApprovalStatus;
  decision?: ApprovalDecision;
  comments?: ApprovalComment[];
}

interface AuditRow {
  id: number;
  createdAt: number;
  eventType: string;
  actorUserId: string;
  actorRole: ActorRole;
  detail: string;
  approvalId?: string;
  approverUserId?: string;
  riskTier?: RiskTier;
  confidenceScore?: number;
}

interface StoreSchema {
  session: {
    userId: string;
    role: Role;
    token: string;
    persistent: boolean;
    expiresAt: number;
  } | null;
  settings: {
    kioskMode: boolean;
    theme: "dark" | "light";
    notifications: boolean;
  };
  auditLog: AuditRow[];
  approvalsQueue: ApprovalRequest[];
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development";
const PYTHON_PORT = 5001;
const VITE_DEV_SERVER_URL = "http://localhost:5173";

// Optional brand icon. If the asset is missing we silently fall back
// to Electron's default icon and skip the system tray (acceptable per
// sprint/decision-tree.md §8 — tray is a Day-1 nice-to-have).
// __dirname after compile is dist-electron/electron/, so we walk up
// two levels to reach the repo root before descending into src/.
const ICON_PATH = path.join(__dirname, "..", "..", "src", "imports", "image.png");
const HAS_ICON = fs.existsSync(ICON_PATH);

// ─────────────────────────────────────────────
//  Persistent store (electron-store)
// ─────────────────────────────────────────────
const store = new Store({
  defaults: {
    session: null,
    settings: {
      kioskMode: false,
      theme: "dark",
      notifications: true,
    },
    auditLog: [] as AuditRow[],
    approvalsQueue: [] as ApprovalRequest[],
  },
});

const AUDIT_LIMIT = 500;
const QUEUE_LIMIT = 100;
const CONFIDENCE_THRESHOLD = 0.7;

const RISK_RULES: Readonly<Record<ActionType, RiskTier>> = {
  chat_response: "low",
  audit_query: "low",
  view_policy: "low",
  health_check: "low",
  recommend_action: "medium",
  draft_policy: "medium",
  mark_notification: "medium",
  wipe_terminal: "high",
  lock_cluster: "high",
  terminate_session: "high",
  quarantine_usb: "high",
  force_logout: "high",
  enforce_blocklist: "high",
};

function classifyAction(action: AgentAction): RiskTier {
  const base: RiskTier = RISK_RULES[action.type] ?? "high";
  if (action.confidence !== undefined && action.confidence < CONFIDENCE_THRESHOLD) {
    if (base === "low") return "medium";
    return "high";
  }
  return base;
}

function getAuditRows(): AuditRow[] {
  const v = store.get("auditLog") as AuditRow[] | undefined;
  return Array.isArray(v) ? v : [];
}

function setAuditRows(rows: AuditRow[]): void {
  store.set("auditLog", rows.slice(-AUDIT_LIMIT));
}

function getQueue(): ApprovalRequest[] {
  const v = store.get("approvalsQueue") as ApprovalRequest[] | undefined;
  return Array.isArray(v) ? v : [];
}

function setQueue(rows: ApprovalRequest[]): void {
  store.set("approvalsQueue", rows.slice(-QUEUE_LIMIT));
}

function nextAuditId(): number {
  const rows = getAuditRows();
  const max = rows.reduce((m, r) => Math.max(m, r.id), 0);
  return max + 1;
}

function logEvent(row: Omit<AuditRow, "id" | "createdAt"> & { id?: number; createdAt?: number }): AuditRow {
  const full: AuditRow = {
    id: row.id ?? nextAuditId(),
    createdAt: row.createdAt ?? Date.now(),
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    detail: row.detail,
    approvalId: row.approvalId,
    approverUserId: row.approverUserId,
    riskTier: row.riskTier,
    confidenceScore: row.confidenceScore,
  };
  setAuditRows([...getAuditRows(), full]);
  return full;
}

function findRequest(id: string): ApprovalRequest | undefined {
  return getQueue().find((r) => r.id === id);
}

function executeAction(action: AgentAction): { ok: boolean; message: string } {
  console.log("[main] executeAction", action.type, JSON.stringify(action.payload));
  return { ok: true, message: `Stub executed: ${action.type} (demo)` };
}

// ─────────────────────────────────────────────
//  Globals
// ─────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pythonProcess: ChildProcess | null = null;

// ─────────────────────────────────────────────
//  Python microservice launcher
// ─────────────────────────────────────────────
function startPythonService(): void {
  const isPacked = app.isPackaged;

  // In production the service is a bundled .exe / binary next to the app
  const servicePath = isPacked
    ? path.join(process.resourcesPath, "python-service", "service.exe")
    : path.join(__dirname, "..", "python-service", "service.py");

  const cmd = isPacked ? servicePath : "python";
  const args = isPacked ? [] : [servicePath];

  console.log(`[main] Starting Python service: ${cmd} ${args.join(" ")}`);

  pythonProcess = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FLASK_PORT: String(PYTHON_PORT) },
  });

  pythonProcess.stdout?.on("data", (d) =>
    console.log("[python]", d.toString().trim())
  );
  pythonProcess.stderr?.on("data", (d) =>
    console.error("[python:err]", d.toString().trim())
  );
  pythonProcess.on("exit", (code) =>
    console.warn(`[main] Python service exited with code ${code}`)
  );
}

function stopPythonService(): void {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// ─────────────────────────────────────────────
//  Main window factory
// ─────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const settings = store.get("settings");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: "PCU Lab Portal",
    backgroundColor: "#0d1320",
    // Hide the default frame so we can use a custom titlebar
    frame: false,
    titleBarStyle: "hidden",
    kiosk: settings.kioskMode,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...(HAS_ICON ? { icon: ICON_PATH } : {}),
  });

  // Load the app
  if (IS_DEV) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Intercept navigation – prevent leaving the app in kiosk mode
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = IS_DEV
      ? url.startsWith(VITE_DEV_SERVER_URL)
      : url.startsWith("file://");
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url); // Open external links in the OS browser
    }
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

// ─────────────────────────────────────────────
//  System tray
// ─────────────────────────────────────────────
function createTray(): Tray | null {
  if (!HAS_ICON) {
    console.warn(
      `[main] Tray icon not found at ${ICON_PATH} — skipping tray creation. ` +
      `Add a 16x16 PNG to enable the tray (see sprint/daily-checklist.md Day 4).`
    );
    return null;
  }
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  const t = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: "PCU Lab Portal", enabled: false },
    { type: "separator" },
    {
      label: "Show Window",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Settings",
      click: () => {
        mainWindow?.webContents.send("navigate", "/settings");
        mainWindow?.show();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  t.setToolTip("PCU Lab Portal");
  t.setContextMenu(menu);
  t.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  return t;
}

// ─────────────────────────────────────────────
//  IPC handlers
// ─────────────────────────────────────────────
function registerIpcHandlers(): void {
  // ── Session management ──────────────────────
  ipcMain.handle("session:get", () => store.get("session"));

  ipcMain.handle("session:set", (_event, session: StoreSchema["session"]) => {
    store.set("session", session);
    return true;
  });

  ipcMain.handle("session:clear", () => {
    store.set("session", null);
    return true;
  });

  // ── Settings ────────────────────────────────
  ipcMain.handle("settings:get", () => store.get("settings"));

  ipcMain.handle(
    "settings:set",
    (_event, partial: Partial<StoreSchema["settings"]>) => {
      const current = store.get("settings");
      const updated = { ...current, ...partial };
      store.set("settings", updated);

      // Apply kiosk mode at runtime
      if ("kioskMode" in partial) {
        mainWindow?.setKiosk(partial.kioskMode!);
      }
      return updated;
    }
  );

  // ── Window controls ─────────────────────────
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());

  // ── Python microservice proxy ────────────────
  ipcMain.handle(
    "python:call",
    async (_event, endpoint: string, payload: unknown) => {
      const { default: axios } = await import("axios");
      try {
        const res = await axios.post(
          `http://localhost:${PYTHON_PORT}${endpoint}`,
          payload,
          { timeout: 15_000 }
        );
        return { ok: true, data: res.data };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Python service error";
        return { ok: false, error: message };
      }
    }
  );

  // ── File dialog ─────────────────────────────
  ipcMain.handle("dialog:openFile", async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Notifications ───────────────────────────
  ipcMain.handle("tray:notify", (_event, title: string, body: string) => {
    if (!tray) return;
    try {
      tray.displayBalloon({ title, content: body });
    } catch {
      /* optional tray balloon */
    }
  });

  // ── Audit log (electron-store) ──────────────
  ipcMain.handle(
    "audit:log",
    (
      _e,
      args: {
        eventType: string;
        detail: string;
        actorUserId: string;
        actorRole: ActorRole;
        approvalId?: string;
        approverUserId?: string;
        riskTier?: RiskTier;
        confidenceScore?: number;
      },
    ) => {
      logEvent({
        eventType: args.eventType,
        detail: args.detail,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole,
        approvalId: args.approvalId,
        approverUserId: args.approverUserId,
        riskTier: args.riskTier,
        confidenceScore: args.confidenceScore,
      });
      return true;
    },
  );

  ipcMain.handle("audit:list", (_e, limit = 200) => {
    const rows = getAuditRows();
    return [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  });

  // ── Agent / HITL queue ───────────────────────
  ipcMain.handle(
    "agent:propose",
    (
      _e,
      args: {
        action: AgentAction;
        requesterId: string;
        requesterRole: Role;
        evidence?: ApprovalEvidence;
      },
    ) => {
      const { action, requesterId, requesterRole, evidence } = args;
      const tier = classifyAction(action);

      if (tier === "high") {
        const request: ApprovalRequest = {
          id: randomUUID(),
          createdAt: Date.now(),
          requesterId,
          requesterRole,
          action,
          riskTier: "high",
          evidence,
          status: "pending",
        };
        setQueue([...getQueue(), request]);
        logEvent({
          eventType: "action_proposed",
          detail: JSON.stringify({ approvalId: request.id, actionType: action.type }),
          actorUserId: requesterId,
          actorRole: requesterRole,
          approvalId: request.id,
          riskTier: "high",
          confidenceScore: action.confidence,
        });
        return { autoExecuted: false, tier: "high" as const, request };
      }

      const result = executeAction(action);
      logEvent({
        eventType: "action_auto_executed",
        detail: JSON.stringify({ actionType: action.type, message: result.message }),
        actorUserId: requesterId,
        actorRole: requesterRole,
        riskTier: tier,
        confidenceScore: action.confidence,
      });
      return { autoExecuted: true as const, tier, result };
    },
  );

  ipcMain.handle("agent:list-pending", () =>
    getQueue().filter((r) => r.status === "pending"),
  );

  ipcMain.handle("agent:list-history", (_e, limit = 50) =>
    getQueue()
      .filter((r) => r.status !== "pending")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit),
  );

  ipcMain.handle(
    "agent:approve",
    (
      _e,
      args: { id: string; approverUserId: string; comment?: string },
    ) => {
      const q = getQueue();
      const idx = q.findIndex((r) => r.id === args.id && r.status === "pending");
      if (idx === -1) throw new Error("Approval request not found or not pending");

      const req = q[idx];
      const decided: ApprovalDecision = {
        decidedAt: Date.now(),
        decidedByUserId: args.approverUserId,
        comment: args.comment,
      };
      const updated: ApprovalRequest = {
        ...req,
        status: "approved",
        decision: decided,
      };
      const next = [...q];
      next[idx] = updated;
      setQueue(next);

      logEvent({
        eventType: "action_approved",
        detail: JSON.stringify({ approvalId: req.id, actionType: req.action.type }),
        actorUserId: args.approverUserId,
        actorRole: "admin",
        approvalId: req.id,
        approverUserId: args.approverUserId,
        riskTier: "high",
      });

      const result = executeAction(req.action);
      logEvent({
        eventType: "action_executed",
        detail: JSON.stringify({ approvalId: req.id, message: result.message }),
        actorUserId: args.approverUserId,
        actorRole: "admin",
        approvalId: req.id,
        approverUserId: args.approverUserId,
        riskTier: "high",
      });

      return { request: updated, result };
    },
  );

  ipcMain.handle(
    "agent:reject",
    (
      _e,
      args: { id: string; approverUserId: string; comment?: string },
    ) => {
      const q = getQueue();
      const idx = q.findIndex((r) => r.id === args.id && r.status === "pending");
      if (idx === -1) throw new Error("Approval request not found or not pending");

      const req = q[idx];
      const updated: ApprovalRequest = {
        ...req,
        status: "rejected",
        decision: {
          decidedAt: Date.now(),
          decidedByUserId: args.approverUserId,
          comment: args.comment,
        },
      };
      const next = [...q];
      next[idx] = updated;
      setQueue(next);

      logEvent({
        eventType: "action_rejected",
        detail: JSON.stringify({ approvalId: req.id }),
        actorUserId: args.approverUserId,
        actorRole: "admin",
        approvalId: req.id,
        approverUserId: args.approverUserId,
        riskTier: "high",
      });

      return updated;
    },
  );

  ipcMain.handle(
    "agent:request-info",
    (_e, args: { id: string; byUserId: string; text: string }) => {
      const q = getQueue();
      const idx = q.findIndex((r) => r.id === args.id && r.status === "pending");
      if (idx === -1) throw new Error("Approval request not found or not pending");

      const req = q[idx];
      const comments = [...(req.comments ?? [])];
      comments.push({ at: Date.now(), byUserId: args.byUserId, text: args.text });
      const updated: ApprovalRequest = {
        ...req,
        status: "info_requested",
        comments,
      };
      const next = [...q];
      next[idx] = updated;
      setQueue(next);

      logEvent({
        eventType: "action_info_requested",
        detail: args.text.slice(0, 500),
        actorUserId: args.byUserId,
        actorRole: "admin",
        approvalId: req.id,
        approverUserId: args.byUserId,
        riskTier: "high",
      });

      return updated;
    },
  );

  // ── App info ────────────────────────────────
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:platform", () => process.platform);
}

// ─────────────────────────────────────────────
//  App lifecycle
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  registerIpcHandlers();
  // startPythonService();  // Re-enabled on Day 3 of the demo sprint
  mainWindow = createMainWindow();
  tray = createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS keep the process alive; on Windows/Linux quit
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopPythonService();
});

// Prevent multiple app instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
