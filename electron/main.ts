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
import fsSync from "fs";
import {
  ensureVaultExists,
  resolveUnderVault,
  sessionRelativeFolder,
  MAX_TEXT_FILE_BYTES,
} from "./runaFiles";

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
  | "runa_create_folder"
  | "runa_write_file"
  | "runa_move_within_vault"
  | "student_hitl_escalation"
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

/** User-added OS shortcuts (.exe / .lnk); not pre-seeded by app defaults. */
interface LabShortcutRow {
  id: string;
  label: string;
  targetPath: string;
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
  /** Dynamic list of lab / IDE shortcuts (add via UI). */
  labShortcuts: LabShortcutRow[];
  auditLog: AuditRow[];
  approvalsQueue: ApprovalRequest[];
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development";
const PYTHON_PORT = 5001;
const VITE_DEV_SERVER_URL = "http://localhost:5173";
/** Prefer loopback IPv4 — avoids Windows resolving `localhost` to ::1 while Flask binds 127.0.0.1. */
const PYTHON_BASE_URL = `http://127.0.0.1:${PYTHON_PORT}`;

// Optional brand icon. If the asset is missing we silently fall back
// to Electron's default icon and skip the system tray (acceptable per
// sprint/decision-tree.md §8 — tray is a Day-1 nice-to-have).
// __dirname after compile is dist-electron/electron/, so we walk up
// two levels to reach the repo root before descending into src/.
const ICON_PATH = path.join(__dirname, "..", "..", "src", "imports", "image.png");
const HAS_ICON = fsSync.existsSync(ICON_PATH);

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
    labShortcuts: [] as LabShortcutRow[],
    auditLog: [] as AuditRow[],
    approvalsQueue: [] as ApprovalRequest[],
  },
});

function readLabShortcuts(): LabShortcutRow[] {
  const raw = store.get("labShortcuts") as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is LabShortcutRow =>
      Boolean(r) &&
      typeof (r as LabShortcutRow).id === "string" &&
      typeof (r as LabShortcutRow).label === "string" &&
      typeof (r as LabShortcutRow).targetPath === "string",
  );
}

/** One-time migration from legacy `labAppShortcuts` record → `labShortcuts` list. */
function migrateLabShortcuts(): void {
  let rows = readLabShortcuts();
  const bag = store.store as Record<string, unknown>;
  const legacy = bag.labAppShortcuts as Record<string, string> | undefined;
  if (
    rows.length === 0 &&
    legacy &&
    typeof legacy === "object" &&
    Object.keys(legacy).length > 0
  ) {
    const labels: Record<string, string> = {
      vscode: "VS Code",
      intellij: "IntelliJ IDEA",
      netbeans: "NetBeans",
      blender: "Blender",
      inkscape: "Inkscape",
      chrome: "Google Chrome",
      terminal: "Terminal",
      explorer: "File Explorer",
    };
    rows = Object.entries(legacy).map(([key, targetPath]) => ({
      id: randomUUID(),
      label: labels[key] ?? key,
      targetPath: String(targetPath).trim(),
    }));
    store.set("labShortcuts", rows);
  }
  if (!Array.isArray(store.get("labShortcuts"))) {
    store.set("labShortcuts", rows);
  }
  if ("labAppShortcuts" in bag) {
    (store as unknown as { delete: (key: string) => void }).delete("labAppShortcuts");
  }
}

/** Rolling in-app audit row cap. Export / archive for thesis retention policy as needed. */
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
  runa_create_folder: "low",
  runa_write_file: "low",
  runa_move_within_vault: "low",
  student_hitl_escalation: "high",
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

  if (action.type === "runa_create_folder") {
    const rel = String(action.payload.relativePath ?? "").trim();
    const resolved = resolveUnderVault(app, rel);
    if (!resolved.ok) return { ok: false, message: resolved.error };
    try {
      fsSync.mkdirSync(resolved.absolute, { recursive: true });
      return { ok: true, message: `Created folder under Runa_Folder: ${rel || "."}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  if (action.type === "runa_write_file") {
    const rel = String(action.payload.relativePath ?? "").trim();
    const content = String(action.payload.content ?? "");
    const buf = Buffer.from(content, "utf8");
    if (buf.length > MAX_TEXT_FILE_BYTES) {
      return { ok: false, message: `File exceeds maximum size (${MAX_TEXT_FILE_BYTES} bytes).` };
    }
    const resolved = resolveUnderVault(app, rel);
    if (!resolved.ok) return { ok: false, message: resolved.error };
    try {
      fsSync.mkdirSync(path.dirname(resolved.absolute), { recursive: true });
      fsSync.writeFileSync(resolved.absolute, buf, { encoding: "utf8" });
      return { ok: true, message: `Wrote file under Runa_Folder: ${rel}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  if (action.type === "runa_move_within_vault") {
    const fromRel = String(action.payload.fromRelative ?? "").trim();
    const toRel = String(action.payload.toRelative ?? "").trim();
    const a = resolveUnderVault(app, fromRel);
    const b = resolveUnderVault(app, toRel);
    if (!a.ok) return { ok: false, message: a.error };
    if (!b.ok) return { ok: false, message: b.error };
    try {
      fsSync.mkdirSync(path.dirname(b.absolute), { recursive: true });
      fsSync.renameSync(a.absolute, b.absolute);
      return { ok: true, message: `Moved within Runa_Folder: ${fromRel} → ${toRel}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  if (action.type === "student_hitl_escalation") {
    return {
      ok: true,
      message:
        "Request recorded. Lab staff will follow up — Runa cannot send email, submit coursework, or change policies autonomously.",
    };
  }

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
  try {
    const isPacked = app.isPackaged;
    const serviceExe = path.join(process.resourcesPath, "python-service", "service.exe");
    // Compiled main lives in dist-electron/electron/ — repo root is two levels up.
    const scriptPath = path.join(__dirname, "..", "..", "python-service", "service.py");

    let cmd: string;
    let args: string[];

    if (isPacked) {
      cmd = serviceExe;
      args = [];
    } else if (!fsSync.existsSync(scriptPath)) {
      console.warn(`[main] Python service script not found at ${scriptPath} — sidecar disabled.`);
      return;
    } else {
      cmd = process.env.PCU_PYTHON_EXE || (process.platform === "win32" ? "python" : "python3");
      args = [scriptPath];
    }

    console.log(`[main] Starting Python service: ${cmd} ${args.join(" ")}`);

    pythonProcess = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FLASK_PORT: String(PYTHON_PORT) },
      windowsHide: true,
    });

    pythonProcess.on("error", (err) => {
      console.error("[main] Python sidecar failed to start:", err.message);
      pythonProcess = null;
    });

    pythonProcess.stdout?.on("data", (d) =>
      console.log("[python]", d.toString().trim()),
    );
    pythonProcess.stderr?.on("data", (d) =>
      console.error("[python:err]", d.toString().trim()),
    );
    pythonProcess.on("exit", (code) =>
      console.warn(`[main] Python service exited with code ${code}`),
    );
  } catch (e) {
    console.error("[main] startPythonService:", e);
  }
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
    minWidth: 1280,
    minHeight: 800,
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
  migrateLabShortcuts();

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
    async (
      _event,
      endpoint: string,
      payload?: unknown,
      options?: { method?: "GET" | "POST"; timeoutMs?: number },
    ) => {
      const { default: axios } = await import("axios");
      const method = options?.method ?? "POST";
      const timeoutMs = options?.timeoutMs ?? 15_000;
      const url = `${PYTHON_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
      try {
        const res =
          method === "GET"
            ? await axios.get(url, { timeout: timeoutMs })
            : await axios.post(url, payload ?? {}, {
                timeout: timeoutMs,
                headers: { "Content-Type": "application/json" },
              });
        return { ok: true, data: res.data };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Python service error";
        return { ok: false, error: message };
      }
    },
  );

  // ── File dialog ─────────────────────────────
  ipcMain.handle("dialog:openFile", async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Student lab shortcuts (dynamic list — add/remove in UI) ─────────────────
  ipcMain.handle("lab:get-shortcuts", () => [...readLabShortcuts()]);

  ipcMain.handle(
    "lab:add-shortcut",
    (_event, payload: { label: string; targetPath: string }) => {
      const session = store.get("session");
      const settings = store.get("settings");
      const list = readLabShortcuts();

      if (settings.kioskMode && session?.role === "student") {
        logEvent({
          eventType: "lab_shortcut_edit_denied",
          detail: JSON.stringify({ reason: "kiosk_student_readonly", op: "add" }),
          actorUserId: session?.userId ?? "unknown",
          actorRole: "student",
          riskTier: "low",
        });
        return {
          ok: false as const,
          shortcuts: list,
          error:
            "Kiosk mode: shortcuts are managed by IT. Contact lab tech to add or change applications.",
        };
      }

      const label = String(payload?.label ?? "").trim().slice(0, 80);
      const targetPath = String(payload?.targetPath ?? "").trim();
      if (!label || !targetPath) {
        return {
          ok: false as const,
          shortcuts: list,
          error: "Enter a display name and choose an executable or shortcut file.",
        };
      }

      const item: LabShortcutRow = { id: randomUUID(), label, targetPath };
      const next = [...list, item];
      store.set("labShortcuts", next);
      logEvent({
        eventType: "lab_shortcut_added",
        detail: JSON.stringify({ id: item.id, label: item.label }),
        actorUserId: session?.userId ?? "system",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      return { ok: true as const, shortcuts: next, item };
    },
  );

  ipcMain.handle(
    "lab:update-shortcut",
    (_event, payload: { id: string; label: string; targetPath: string }) => {
      const session = store.get("session");
      const settings = store.get("settings");
      const list = readLabShortcuts();

      if (settings.kioskMode && session?.role === "student") {
        logEvent({
          eventType: "lab_shortcut_edit_denied",
          detail: JSON.stringify({ id: payload.id, reason: "kiosk_student_readonly", op: "update" }),
          actorUserId: session?.userId ?? "unknown",
          actorRole: "student",
          riskTier: "low",
        });
        return {
          ok: false as const,
          shortcuts: list,
          error:
            "Kiosk mode: shortcuts are managed by IT. Contact lab tech to change applications.",
        };
      }

      const id = String(payload?.id ?? "").trim();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) {
        return {
          ok: false as const,
          shortcuts: list,
          error: "Shortcut not found.",
        };
      }

      const label = String(payload?.label ?? "").trim().slice(0, 80);
      const targetPath = String(payload?.targetPath ?? "").trim();
      if (!label || !targetPath) {
        return {
          ok: false as const,
          shortcuts: list,
          error: "Display name and target path are required.",
        };
      }

      const next = [...list];
      next[idx] = { ...list[idx], label, targetPath };
      store.set("labShortcuts", next);
      logEvent({
        eventType: "lab_shortcut_updated",
        detail: JSON.stringify({ id, label }),
        actorUserId: session?.userId ?? "system",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      return { ok: true as const, shortcuts: next, item: next[idx] };
    },
  );

  ipcMain.handle("lab:remove-shortcut", (_event, id: string) => {
    const session = store.get("session");
    const settings = store.get("settings");
    const list = readLabShortcuts();

    if (settings.kioskMode && session?.role === "student") {
      logEvent({
        eventType: "lab_shortcut_edit_denied",
        detail: JSON.stringify({ id, reason: "kiosk_student_readonly", op: "remove" }),
        actorUserId: session?.userId ?? "unknown",
        actorRole: "student",
        riskTier: "low",
      });
      return {
        ok: false as const,
        shortcuts: list,
        error:
          "Kiosk mode: shortcuts are managed by IT. Contact lab tech to remove an entry.",
      };
    }

    const next = list.filter((r) => r.id !== id);
    store.set("labShortcuts", next);
    logEvent({
      eventType: "lab_shortcut_removed",
      detail: JSON.stringify({ id }),
      actorUserId: session?.userId ?? "system",
      actorRole: session?.role ?? "system",
      riskTier: "low",
    });
    return { ok: true as const, shortcuts: next };
  });

  ipcMain.handle("lab:launch", async (_event, id: string) => {
    const session = store.get("session");
    const row = readLabShortcuts().find((r) => r.id === id);
    const p = row?.targetPath?.trim();
    if (!p) {
      logEvent({
        eventType: "lab_app_launch",
        detail: JSON.stringify({ id, ok: false, reason: "not_found" }),
        actorUserId: session?.userId ?? "unknown",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      return {
        ok: false,
        error:
          "That shortcut is missing. Add it from the side panel (Add shortcut), or ask lab tech in kiosk labs.",
      };
    }
    try {
      const err = await shell.openPath(p);
      logEvent({
        eventType: "lab_app_launch",
        detail: JSON.stringify({ id, label: row?.label, ok: !err, pathTail: p.slice(-64) }),
        actorUserId: session?.userId ?? "unknown",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      if (err) return { ok: false, error: err };
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logEvent({
        eventType: "lab_app_launch",
        detail: JSON.stringify({ id, ok: false, error: msg }),
        actorUserId: session?.userId ?? "unknown",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      return { ok: false, error: msg };
    }
  });

  // ── Runa_Folder vault (student-safe automation root) ───────────────────────
  ipcMain.handle("runaFiles:getVaultRoot", () => {
    try {
      const root = ensureVaultExists(app);
      return { ok: true as const, path: root };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
        path: null as string | null,
      };
    }
  });

  ipcMain.handle("runaFiles:getSessionWorkspaceRelative", () => {
    const session = store.get("session");
    if (!session?.userId) {
      return { ok: false as const, error: "Not signed in.", relative: null as string | null };
    }
    return {
      ok: true as const,
      relative: sessionRelativeFolder(session.userId),
    };
  });

  ipcMain.handle("runaFiles:createFolder", (_e, relativePath: string) => {
    const session = store.get("session");
    if (!session?.userId) {
      return { ok: false as const, error: "Not signed in." };
    }
    const resolved = resolveUnderVault(app, relativePath);
    if (!resolved.ok) {
      return { ok: false as const, error: resolved.error };
    }
    try {
      fsSync.mkdirSync(resolved.absolute, { recursive: true });
      logEvent({
        eventType: "runa_files_mkdir",
        detail: JSON.stringify({ relativePath }),
        actorUserId: session.userId,
        actorRole: session.role,
        riskTier: "low",
      });
      return { ok: true as const, absolute: resolved.absolute };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logEvent({
        eventType: "runa_files_error",
        detail: JSON.stringify({ op: "mkdir", relativePath, error: msg }),
        actorUserId: session.userId,
        actorRole: session.role,
        riskTier: "low",
      });
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("runaFiles:writeTextFile", (_e, relativePath: string, content: string) => {
    const session = store.get("session");
    if (!session?.userId) {
      return { ok: false as const, error: "Not signed in." };
    }
    const buf = Buffer.from(String(content ?? ""), "utf8");
    if (buf.length > MAX_TEXT_FILE_BYTES) {
      return { ok: false as const, error: `File too large (max ${MAX_TEXT_FILE_BYTES} bytes).` };
    }
    const resolved = resolveUnderVault(app, relativePath);
    if (!resolved.ok) {
      return { ok: false as const, error: resolved.error };
    }
    try {
      fsSync.mkdirSync(path.dirname(resolved.absolute), { recursive: true });
      fsSync.writeFileSync(resolved.absolute, buf, { encoding: "utf8" });
      logEvent({
        eventType: "runa_files_write",
        detail: JSON.stringify({ relativePath, bytes: buf.length }),
        actorUserId: session.userId,
        actorRole: session.role,
        riskTier: "low",
      });
      return { ok: true as const, absolute: resolved.absolute };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logEvent({
        eventType: "runa_files_error",
        detail: JSON.stringify({ op: "write", relativePath, error: msg }),
        actorUserId: session.userId,
        actorRole: session.role,
        riskTier: "low",
      });
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("runaFiles:listDir", (_e, relativePath: string) => {
    const session = store.get("session");
    if (!session?.userId) {
      return { ok: false as const, error: "Not signed in.", entries: [] as string[] };
    }
    const resolved = resolveUnderVault(app, relativePath);
    if (!resolved.ok) {
      return { ok: false as const, error: resolved.error, entries: [] as string[] };
    }
    try {
      const names = fsSync.readdirSync(resolved.absolute);
      logEvent({
        eventType: "runa_files_list",
        detail: JSON.stringify({ relativePath, count: names.length }),
        actorUserId: session.userId,
        actorRole: session.role,
        riskTier: "low",
      });
      return { ok: true as const, entries: names };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg, entries: [] as string[] };
    }
  });

  ipcMain.handle(
    "telemetry:record",
    (_e, event: string, meta?: Record<string, unknown>) => {
      const session = store.get("session");
      logEvent({
        eventType: "feature_usage",
        detail: JSON.stringify({ event, meta: meta ?? {} }),
        actorUserId: session?.userId ?? "anonymous",
        actorRole: session?.role ?? "system",
        riskTier: "low",
      });
      return true;
    },
  );

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
  try {
    ensureVaultExists(app);
  } catch (e) {
    console.error("[main] Runa_Folder vault init:", e);
  }
  startPythonService();
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
