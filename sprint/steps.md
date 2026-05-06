# Steps — Granular Series of Tasks

Concrete, copy-pasteable steps to take, grouped by day. Each step is small enough to commit individually. **Pair this file with `daily-checklist.md`** — that file is your tickable to-do list, this file is the "how."

> Conventions: All shell commands assume `cwd = repo root`. We use `pnpm`. If you use `npm`, swap `pnpm add` → `npm install --save` and `pnpm dev` → `npm run dev`.

---

## §1 Day 1 — Foundation

### 1.1 Add Electron-side dependencies

Run-time deps:

```bash
pnpm add electron@^31 electron-store@^8 axios@^1
```

> Note on `electron-store`: we **pin to v8** because v10+ is ESM-only and our `electron/main.ts` is compiled to CommonJS via `tsconfig.electron.json`. If you want v10, you must also flip `tsconfig.electron.json` to `"module": "ES2022"` and add `"type": "module"` plumbing — not worth the cost during the sprint.

Optional native dep (defer if it causes pain — see `decision-tree.md` §2):

```bash
pnpm add better-sqlite3@^11
```

Dev deps:

```bash
pnpm add -D electron-builder concurrently wait-on cross-env @types/better-sqlite3
```

### 1.2 Patch `package.json`

Add the following keys (merge into existing object — don't replace it):

```json
{
  "main": "dist-electron/electron/main.js",
  "scripts": {
    "dev:vite": "vite",
    "build:electron": "tsc -p tsconfig.electron.json",
    "dev:electron": "wait-on tcp:5173 && pnpm build:electron && cross-env NODE_ENV=development electron .",
    "dev": "concurrently -k -n vite,electron -c blue,green \"pnpm dev:vite\" \"pnpm dev:electron\"",
    "build": "vite build && pnpm build:electron",
    "build:win": "pnpm build && electron-builder --win portable",
    "rebuild:native": "electron-rebuild -f -w better-sqlite3"
  },
  "build": {
    "appId": "ph.edu.pcu.lab-portal",
    "productName": "PCU Lab Portal",
    "directories": { "output": "release" },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ],
    "extraResources": [
      { "from": "python-service", "to": "python-service", "filter": ["**/*.py"] }
    ],
    "win": { "target": "portable", "icon": "src/imports/image.png" }
  }
}
```

### 1.3 Add a placeholder app/tray icon

`electron/main.ts` references `src/imports/image.png` — that folder doesn't exist yet. Either:

- **Option A (recommended):** Create `src/imports/image.png` (256×256 PNG, even a solid color is fine for the sprint).
- **Option B:** Edit `electron/main.ts` and remove both `icon:` lines so Electron uses its default. (Faster, but the demo will show the green Electron logo in the tray.)

### 1.4 Compile electron once

```bash
pnpm build:electron
```

Expect potential TS issues:

- `noUnusedLocals` / `noUnusedParameters` — add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` or rename `_event` etc. to satisfy the compiler. The renderer `tsconfig.json` already has these off, but `tsconfig.electron.json` inherits `strict: true`. Add `"noUnusedLocals": false, "noUnusedParameters": false` to `tsconfig.electron.json` to keep moving.
- `electron-store` import may need `import Store from "electron-store"` and instantiation `new Store(...)` (lowercase `electronStore` is fine but check the v8 typings).

### 1.5 First boot

```bash
pnpm dev
```

Expected:
- Vite serves on `http://localhost:5173`.
- After ~3 s, `wait-on` releases and Electron compiles + launches a window pointing at the dev URL.
- The custom titlebar shows at the top.
- DevTools open detached.

If the window opens blank, check:
- `index.html` has `<script type="module" src="/src/main.tsx">` — present.
- `vite.config.mjs` has `base: './'` — present (good).
- DevTools console for path errors.

### 1.6 Verify titlebar + tray + single instance

- Drag the title bar — window should move.
- Click min / max / close — should work.
- Open the system tray (Windows notification area) — tray icon present, right-click shows menu.
- Run `pnpm dev` a second time in another terminal — second instance should immediately exit and the first should focus.

### 1.7 Disable the Python spawn for Day 1

In `electron/main.ts`, comment out the `startPythonService()` call inside `app.whenReady()`. We'll re-enable it on Day 3.

### 1.8 Commit

```bash
git add -A && git commit -m "sprint d1: electron boots with React UI"
git tag day-1-green
```

---

## §2 Day 2 — Auth + Session

### 2.1 Centralize demo credentials

Create `src/app/auth/demoUsers.ts`:

```ts
export type DemoRole = "admin" | "student";

export interface DemoUser {
  email: string;
  password: string;
  role: DemoRole;
  displayName: string;
}

export const DEMO_USERS: DemoUser[] = [
  { email: "admin@runa.edu.ph",   password: "runa-admin",   role: "admin",   displayName: "System Administrator" },
  { email: "student@runa.edu.ph", password: "runa-student", role: "student", displayName: "John Doe" },
];

export function authenticate(email: string, password: string): DemoUser | null {
  const e = email.trim().toLowerCase();
  return DEMO_USERS.find(u => u.email === e && u.password === password) ?? null;
}
```

### 2.2 Wire `LoginPage` to the IPC session

Edit `src/app/components/LoginPage.tsx` `handleSignIn`:

```tsx
import { useElectron } from "../ipc/useElectron";
import { authenticate } from "../auth/demoUsers";

const { session: sessionApi } = useElectron();

const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  const user = authenticate(email, password);
  if (!user || user.role !== role) {
    // simple error UX — set a state and render a message
    setLoginError("Invalid credentials for the selected role");
    return;
  }
  await sessionApi.set({
    userId: user.email,
    role: user.role,
    token: crypto.randomUUID(),
    persistent,
    expiresAt: Date.now() + 1000 * 60 * 60 * 2.75, // 2h45m
  });
  navigate(user.role === "admin" ? "/dashboard" : "/student-dashboard");
};
```

Add `loginError` state and a small red text under the password field.

### 2.3 Add a `SessionGuard` to `Root.tsx`

```tsx
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useElectron } from "../ipc/useElectron";

export function Root() {
  const { session: sessionApi } = useElectron();
  const navigate = useNavigate();
  const location = useLocation();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await sessionApi.get();
      if (cancelled) return;
      const protectedPath = location.pathname.startsWith("/dashboard")
                         || location.pathname.startsWith("/student-dashboard");
      const expired = s && s.expiresAt < Date.now();

      if (!s || expired) {
        if (s && expired) await sessionApi.clear();
        if (protectedPath) navigate("/", { replace: true });
      } else if (location.pathname === "/") {
        // already logged in, bounce to the right dashboard
        navigate(s.role === "admin" ? "/dashboard" : "/student-dashboard", { replace: true });
      }
      setBootstrapping(false);
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (bootstrapping) return null; // or a tiny splash
  return <Outlet />;
}
```

### 2.4 Wire logout buttons

In `Dashboard.tsx` and `StudentDashboard.tsx`, the existing Logout button currently does `navigate("/")`. Change to:

```tsx
const { session: sessionApi } = useElectron();
// ...
onClick={async () => {
  await sessionApi.clear();
  navigate("/", { replace: true });
}}
```

### 2.5 Tray-driven logout

In `electron/main.ts`, add a Logout item to the tray menu that:

```ts
{
  label: "Logout",
  click: () => {
    store.set("session", null);
    mainWindow?.webContents.send("navigate", "/");
    mainWindow?.show();
  },
}
```

In `Root.tsx`, also subscribe to `electronAPI.on("navigate", path => navigate(path, { replace: true }))`.

### 2.6 Session timer hard-stop (student kiosk)

In `StudentDashboard.tsx`, when `secondsUsed` reaches a threshold (e.g. 10s during demo, 9900s in real use), call `sessionApi.clear()` and `navigate("/")`. **For demo, expose this via a Settings → "Force expire session in 30 s" button** so we can trigger it on stage.

### 2.7 Smoke test

1. Login as admin → land on `/dashboard`.
2. Close Electron.
3. Re-open with `pnpm dev` → should land directly on `/dashboard` (persistent session).
4. Logout → land on `/`.
5. Close Electron.
6. Re-open → land on `/` (no session).

### 2.8 Commit

```bash
git add -A && git commit -m "sprint d2: real session round-trip via electron-store"
git tag day-2-green
```

---

## §3 Day 3 — Sidecar + Persistence

### 3.1 Re-enable Python spawn

Un-comment `startPythonService()` in `electron/main.ts`. Verify `python --version` works in the same shell that launches `pnpm dev`. If `python` isn't on PATH, edit the spawn `cmd` to `"py"` (Windows launcher) or hard-code the absolute path.

### 3.2 Install Python deps once

```bash
cd python-service
pip install flask groq boto3 python-clamd watchdog requests pyusb
cd ..
```

ClamAV / pyusb may fail to import — that's fine, the service has stubs.

### 3.3 Health badge

Add a small `<HealthDot />` to the admin TopBar in `Dashboard.tsx`:

```tsx
const [health, setHealth] = useState<"ok" | "down" | "loading">("loading");
useEffect(() => {
  let alive = true;
  const ping = async () => {
    const res = await usePython().call<{ status: string }>("/health");
    if (!alive) return;
    setHealth(res.ok && res.data?.status === "ok" ? "ok" : "down");
  };
  ping();
  const t = setInterval(ping, 10_000);
  return () => { alive = false; clearInterval(t); };
}, []);
```

> Note: `/health` is GET, not POST. Either change `python.call` to support GET, or expose a thin `axios.get` for `/health`. Easiest: in `electron/main.ts`, accept an optional `method` arg in the `python:call` IPC handler.

### 3.4 Real action: Scan File button

In `AccessControlPanel.tsx`, add a new "RUN FILE SCAN" tile next to "Lock Cluster":

```tsx
const onScanFile = async () => {
  const path = await window.electronAPI.dialog.openFile();
  if (!path) return;
  const res = await window.electronAPI.python.call<{ clean: boolean; threat?: string; sha256: string }>(
    "/scan-file",
    { path }
  );
  // toast via your existing useNotifications().pushToast(...) helper
  pushToast({
    type: res.ok && res.data?.clean ? "success" : "warning",
    title: res.ok ? (res.data?.clean ? "File clean" : `Threat: ${res.data?.threat}`) : "Scan failed",
    message: res.data?.sha256 ?? res.error ?? "",
  });
  await window.electronAPI.tray.notify("File Scan", res.data?.clean ? "Clean" : "Threat detected");
};
```

> If `useNotifications` doesn't expose `pushToast` externally, add a small wrapper or lift the toast state into a Context provider in `App.tsx`.

### 3.5 Persistence — Path A (SQLite, preferred)

In `electron/main.ts`, import the helpers from `db.ts`:

```ts
import { logEvent, getAuditLog, createSession, terminateSession } from "./db";
```

Add IPC handlers:

```ts
ipcMain.handle("audit:log",  (_e, eventType: string, detail?: string, userId?: string) =>
  logEvent(eventType, detail, userId)
);
ipcMain.handle("audit:list", (_e, limit?: number, userId?: string) => getAuditLog(limit, userId));
```

Extend `electron/preload.ts`:

```ts
audit: {
  log:  (eventType: string, detail?: string, userId?: string) =>
    ipcRenderer.invoke("audit:log", eventType, detail, userId),
  list: (limit?: number, userId?: string) =>
    ipcRenderer.invoke("audit:list", limit, userId),
},
```

…and the `ElectronAPI` typings in `src/types/electron.d.ts`.

In `LoginPage` (after `session.set`) call `audit.log("login", user.email, user.email)`. In `Scan File`, call `audit.log("file_scan", JSON.stringify({ path, clean: res.data?.clean }), currentUserId)`.

In `AuditTrailsPanel.tsx`, replace the seed `logsPerLab` with a fetched list:

```tsx
const [rows, setRows] = useState<AuditRow[]>([]);
useEffect(() => { window.electronAPI.audit.list(100).then(setRows); }, []);
```

Map `rows` into the existing table layout (add a synthetic station / student name from the userId for display).

### 3.5b Persistence — Path B (electron-store fallback)

If `better-sqlite3` won't compile, replace the `db` helpers with `electron-store`-backed equivalents. Define `auditLog: AuditRow[]` in `StoreSchema`, then:

```ts
function logEvent(eventType, detail, userId) {
  const arr = store.get("auditLog");
  arr.unshift({ id: arr.length + 1, eventType, detail, userId, created_at: Date.now() / 1000 });
  store.set("auditLog", arr.slice(0, 500));
}
function getAuditLog(limit = 100) { return store.get("auditLog").slice(0, limit); }
```

Same IPC surface, same renderer code — only the storage differs.

### 3.6 Smoke test Day 3

1. Launch app, login as admin.
2. Health badge turns green within 10 s.
3. Click "Run File Scan" → pick any `.txt` → toast appears with SHA-256.
4. Open Audit Trails → see one `file_scan` row at the top.
5. Close + re-open → row still there.

### 3.7 Commit

```bash
git add -A && git commit -m "sprint d3: python sidecar + audit-log persistence"
git tag day-3-green
```

---

## §4 Day 4 — Integration + Polish

### 4.1 De-randomize seed data

`LabDashboardPanel.tsx` uses `Math.random()` to generate PC statuses on mount. Replace with deterministic seeded data so screenshots/rehearsals reproduce. Easiest: hard-code a `STATIC_GRIDS` constant per ComLab, mirroring what we want the panelists to see.

Same treatment for `LabMonitoringPanel.tsx` `generatePCs` and `AccessControlPanel.tsx` `genNodes`.

### 4.2 Wire Lock Cluster

In `AccessControlPanel.tsx` Lock confirm modal:

```tsx
onClick={async () => {
  await window.electronAPI.policy.set("comlab_08_locked", "1");
  await window.electronAPI.audit.log("cluster_locked", "COMLAB 08", currentUserId);
  setLocked(true);
  setLockConfirm(false);
  pushToast({ type: "warning", title: "COMLAB 08 locked", message: "All terminals frozen" });
}}
```

Add `policy:get/set` IPC handlers in main + `policy` namespace in preload + typings (mirror the `audit:*` work from §3.5).

On panel mount, read the policy and initialize `locked` state from it.

### 4.3 Wire Terminate All Sessions

```tsx
onClick={async () => {
  await window.electronAPI.audit.log("mass_termination", "COMLAB 08", currentUserId);
  // optional: clear DB sessions table here
  setTerminated(true);
  setTerminateConfirm(false);
  pushToast({ type: "destructive", title: "Sessions terminated", message: "18 users force-signed-out" });
}}
```

### 4.4 Wire Kiosk Mode toggle

In `SettingsPanel.tsx`, find the kiosk-related toggle (or add one under "Privacy & security") that calls:

```tsx
await window.electronAPI.settings.set({ kioskMode: !current.kioskMode });
```

The existing `settings:set` handler already calls `mainWindow.setKiosk(...)` — verify it works. Add a **prominent escape** during the demo: `globalShortcut.register('CommandOrControl+Shift+K', () => mainWindow.setKiosk(false))` in `main.ts`.

### 4.5 Tray notification on alert action

In `LabMonitoringPanel.tsx`, the "WIPE TERMINAL" button currently does nothing. Make it call:

```tsx
await window.electronAPI.tray.notify("Terminal Wiped", "PC-01 has been wiped per admin override");
await window.electronAPI.audit.log("terminal_wiped", "C08-PC01", currentUserId);
```

### 4.6 Student session expiry

In `StudentDashboard.tsx`, add:

```tsx
useEffect(() => {
  if (secondsUsed >= 9900) { // 2h45m
    window.electronAPI.session.clear().then(() => navigate("/"));
  }
}, [secondsUsed]);
```

For demo purposes, also expose a "Force Logout" item in the user dropdown.

### 4.7 Notification provider lift

The `useNotifications` hook is currently used inside `Dashboard` and `StudentDashboard` separately, so toasts triggered from deep panels won't route. Lift it into a `NotificationProvider` Context wrapping the router outlet, and have `pushToast` accessible everywhere.

### 4.8 First full demo dry run

Open `demo-script.md` and walk through it end-to-end. Note every snag in `daily-checklist.md` Day 4 "Found during dry run" section.

### 4.9 Commit

```bash
git add -A && git commit -m "sprint d4: command overrides + kiosk + seeded data"
git tag day-4-green
```

---

## §5 Day 5 — Build + Rehearse

### 5.1 (Required) Produce a portable `.exe`

```bash
pnpm build:win
```

Expected output: `release/PCU Lab Portal-1.0.0-portable.exe`. Test it on the demo machine. If `better-sqlite3` rebuild fails, run:

```bash
pnpm rebuild:native
pnpm build:win
```

If it still fails, keep SQLite deferred and continue packaging with local JSON fallback; use dev launcher only as emergency Plan B.

### 5.1b Bundle Python sidecar for packaged mode

Build `python-service/service.exe` and ensure Electron packaged mode starts this binary from `extraResources/python-service/service.exe`.

Required outcome:

- Packaged `.exe` launches without system Python installed.
- Sidecar endpoints (`/health`, `/ai-task`, `/scan-file`) are reachable in packaged run.

### 5.1c Packaging readiness gate

Before rehearsal, verify in packaged mode:

1. Sidecar check: healthy.
2. Groq check: configured and callable.
3. Supabase check: reachable for shared-state reads/writes.

If any check fails, fix and rebuild before continuing.

### 5.2 Dev-mode launcher (emergency fallback only)

Create `run-demo.bat` at the repo root:

```bat
@echo off
cd /d %~dp0
start "vite" cmd /c "pnpm dev:vite"
timeout /t 5 /nobreak >nul
start "python" cmd /c "python python-service\service.py"
timeout /t 2 /nobreak >nul
pnpm dev:electron
```

> The double `cmd /c` keeps Vite + Python running in their own consoles for log visibility but lets you Ctrl+C the Electron process to clean up.

### 5.3 Three rehearsals

Run `demo-script.md` three times in a row, timing each. Target: 8 minutes ± 1.

After each run, fix what broke and re-run. By rehearsal 3 you should not be touching code.

### 5.4 Backup recording

Use Windows Game Bar (Win+G) or OBS to record one clean run. If the live demo fails, you play the recording.

### 5.5 Pack the demo bundle

Create a USB key / zip with:

- `run-demo.bat`
- `release/PCU Lab Portal-portable.exe` (if §5.1 succeeded)
- `python-service/` (entire folder)
- `README-DEMO.md` — one-page "how to launch" for the demo operator
- `backup-demo.mp4` — the recording

### 5.6 Final commit + tag

```bash
git add -A && git commit -m "sprint d5: demo bundle ready"
git tag demo-ready
```

---

## §6 Agentic Spine — Tier 0 work (overlays Days 2–4)

> **Reordered after reading the thesis rationale.** This section is additive to §2–§4 above. Where §2–§4 plan the original auth/sidecar/polish work, §6 plans the bounded-agentic spine that makes the demo defensible. Read `agentic-architecture.md` first.

**Day 2 absorbs §6.1–§6.7 alongside the original §2 auth work.**
**Day 3 absorbs §6.8–§6.11 alongside the original §3 sidecar work.**
**Day 4 absorbs §6.12–§6.16 alongside the original §4 polish + the carried-over Tier 1 work.**

### 6.1 Type definitions (`src/app/agentic/types.ts`)

```ts
export type RiskTier = 'low' | 'medium' | 'high';

export type ActionType =
  | 'chat_response' | 'audit_query' | 'view_policy' | 'health_check'
  | 'recommend_action' | 'draft_policy' | 'mark_notification'
  | 'wipe_terminal' | 'lock_cluster' | 'terminate_session'
  | 'quarantine_usb' | 'force_logout' | 'enforce_blocklist';

export type AgentRole = 'student' | 'admin';

export interface AgentAction {
  type: ActionType;
  scope: 'self' | 'session' | 'lab' | 'system';
  reversible: boolean;
  payload: Record<string, unknown>;
  confidence?: number; // 0..1, only for AI-driven
  reasoning: string;
}

export interface ApprovalRequest {
  id: string;
  createdAt: number;
  requesterId: string;
  requesterRole: AgentRole;
  action: AgentAction;
  riskTier: 'high';
  evidence?: { scanResult?: unknown; aiConfidence?: number; sourceAlert?: string };
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  decision?: { decidedAt: number; decidedByUserId: string; comment?: string };
  comments?: Array<{ at: number; byUserId: string; text: string }>;
}

export interface ToolDefinition {
  id: string;
  label: string;
  riskTier: RiskTier;
  description: string;
  systemPromptHint: string;
}

export interface AgentContext {
  role: AgentRole;
  userId: string;
  availableTools: ToolDefinition[];
  systemPrompt: string;
}
```

### 6.2 Risk classifier (`src/app/agentic/riskClassifier.ts`)

```ts
import type { AgentAction, RiskTier, ActionType } from './types';

const RISK_RULES: Record<ActionType, RiskTier> = {
  chat_response: 'low',  audit_query: 'low',  view_policy: 'low',  health_check: 'low',
  recommend_action: 'medium',  draft_policy: 'medium',  mark_notification: 'medium',
  wipe_terminal: 'high',  lock_cluster: 'high',  terminate_session: 'high',
  quarantine_usb: 'high',  force_logout: 'high',  enforce_blocklist: 'high',
};

export function classifyAction(action: AgentAction): RiskTier {
  const baseTier = RISK_RULES[action.type] ?? 'high'; // unknown = HIGH (fail-safe)
  if (action.confidence !== undefined && action.confidence < 0.7) {
    return escalateOneTier(baseTier);
  }
  return baseTier;
}

function escalateOneTier(t: RiskTier): RiskTier {
  return t === 'low' ? 'medium' : 'high';
}

export const RISK_RULES_TABLE = RISK_RULES; // exported for the panelist-facing UI tooltip
```

### 6.3 Tool registry (`src/app/agentic/toolRegistry.ts`)

```ts
import type { ToolDefinition, AgentRole, AgentContext } from './types';

const STUDENT_TOOLS: ToolDefinition[] = [
  { id: 'summarize_text',  label: 'Summarize text',     riskTier: 'low', description: 'Summarize a passage you paste in.', systemPromptHint: 'Provide a 3-sentence summary preserving key claims.' },
  { id: 'explain_concept', label: 'Explain a concept',  riskTier: 'low', description: 'Explain an academic concept.',       systemPromptHint: 'Explain plainly with an example.' },
  { id: 'code_review',     label: 'Review code',        riskTier: 'low', description: 'Comment on pasted code.',            systemPromptHint: 'Focus on correctness and readability.' },
  { id: 'generate_outline',label: 'Generate outline',   riskTier: 'low', description: 'Outline an essay or paper.',         systemPromptHint: 'Produce a 3-level outline.' },
  { id: 'explain_error',   label: 'Explain an error',   riskTier: 'low', description: 'Explain a pasted error message.',    systemPromptHint: 'Identify the cause and suggest a fix.' },
];

const ADMIN_TOOLS: ToolDefinition[] = [
  { id: 'summarize_audit',     label: 'Summarize audit log',     riskTier: 'low',    description: 'Summarize today\'s audit log.',     systemPromptHint: 'Highlight unusual events.' },
  { id: 'explain_alert',       label: 'Explain a security alert',riskTier: 'low',    description: 'Explain a specific alert.',         systemPromptHint: 'Explain in plain terms.' },
  { id: 'recommend_response',  label: 'Recommend a response',    riskTier: 'medium', description: 'Recommend response to an alert.',  systemPromptHint: 'Provide 2–3 ranked options.' },
  { id: 'draft_policy',        label: 'Draft policy update',     riskTier: 'medium', description: 'Draft a website blocklist update.',systemPromptHint: 'Provide a specific draft entry.' },
  { id: 'propose_action',      label: 'Propose action (HITL)',   riskTier: 'high',   description: 'Queue a state-mutating action.',   systemPromptHint: 'Describe the proposed action and rationale.' },
];

const STUDENT_PROMPT = `You are a bounded academic assistant for a CS student. You may only respond to messages sent in this chat. You may not read files, access the network, or modify any system state. If asked to do anything beyond academic explanation, refuse and suggest the student contact lab staff.`;

const ADMIN_PROMPT = `You are a bounded operational assistant for a laboratory administrator. You may summarize, recommend, and draft, but you may not directly execute any state-mutating action. HIGH-risk actions must be approved in the Approvals Queue. For the defense run, proposer and approver are separate users/devices.`;

export function getAgentContext(role: AgentRole, userId: string): AgentContext {
  return {
    role, userId,
    availableTools: role === 'student' ? STUDENT_TOOLS : ADMIN_TOOLS,
    systemPrompt: role === 'student' ? STUDENT_PROMPT : ADMIN_PROMPT,
  };
}
```

### 6.4 Approval queue (`src/app/agentic/approvalQueue.ts`)

In-memory cache + persisted to `electron-store` under key `approvals_queue`. Wraps the IPC surface from the renderer's perspective.

```ts
import type { ApprovalRequest, AgentAction } from './types';

const electronAPI = (window as any).electronAPI;

export async function proposeAction(action: AgentAction, requesterId: string, requesterRole: 'student' | 'admin'): Promise<ApprovalRequest> {
  return await electronAPI.agent.propose({ action, requesterId, requesterRole });
}

export async function listPending(): Promise<ApprovalRequest[]> {
  return await electronAPI.agent.listPending();
}

export async function approveRequest(id: string, approverUserId: string, comment?: string): Promise<ApprovalRequest> {
  return await electronAPI.agent.approve({ id, approverUserId, comment });
}

export async function rejectRequest(id: string, approverUserId: string, comment?: string): Promise<ApprovalRequest> {
  return await electronAPI.agent.reject({ id, approverUserId, comment });
}

export async function requestInfo(id: string, byUserId: string, text: string): Promise<ApprovalRequest> {
  return await electronAPI.agent.requestInfo({ id, byUserId, text });
}
```

Main-process side (`electron/main.ts`):

```ts
const APPROVAL_KEY = 'approvals_queue';
function getQueue(): ApprovalRequest[] { return store.get(APPROVAL_KEY, []) as ApprovalRequest[]; }
function setQueue(q: ApprovalRequest[]) { store.set(APPROVAL_KEY, q); }

ipcMain.handle('agent:propose', async (_e, args: { action: AgentAction; requesterId: string; requesterRole: 'student' | 'admin' }) => {
  // Risk-classify on the main side as well as renderer (defense in depth)
  const tier = classifyAction(args.action);
  if (tier === 'low') {
    // LOW auto-execute path — queue not used
    return { autoExecuted: true, tier };
  }
  // Sprint lock (2026-05-05): MEDIUM and HIGH both route through HITL.
  const req: ApprovalRequest = {
    id: crypto.randomUUID(), createdAt: Date.now(),
    requesterId: args.requesterId, requesterRole: args.requesterRole,
    action: args.action, riskTier: 'high', status: 'pending',
  };
  setQueue([req, ...getQueue()]);
  await logEvent('action_proposed', JSON.stringify({ approvalId: req.id, action: args.action }), args.requesterId, { riskTier: 'high', approvalId: req.id });
  return req;
});

ipcMain.handle('agent:list-pending', () => getQueue().filter(r => r.status === 'pending'));

ipcMain.handle('agent:approve', async (_e, args: { id: string; approverUserId: string; comment?: string }) => {
  const q = getQueue();
  const req = q.find(r => r.id === args.id);
  if (!req || req.status !== 'pending') throw new Error('Not pending');
  req.status = 'approved';
  req.decision = { decidedAt: Date.now(), decidedByUserId: args.approverUserId, comment: args.comment };
  setQueue(q);
  await logEvent('action_approved', JSON.stringify({ approvalId: req.id }), args.approverUserId, { riskTier: 'high', approvalId: req.id, approverUserId: args.approverUserId });
  // Execute: dispatch by action.type
  await executeAction(req.action, req.requesterId, args.approverUserId, req.id);
  await logEvent('action_executed', JSON.stringify({ approvalId: req.id, action: req.action }), 'system', { riskTier: 'high', approvalId: req.id, approverUserId: args.approverUserId });
  return req;
});
// agent:reject, agent:request-info similarly
```

Add the `agent` namespace to `electron/preload.ts` and `src/types/electron.d.ts`.

### 6.5 RiskBadge component (`src/app/components/agentic/RiskBadge.tsx`)

Tiny component. ~30 lines. Renders a chip with the tier name + tooltip describing the rule that classified it.

### 6.6 Productivity Assistant (`src/app/components/agentic/ProductivityAssistant.tsx`)

Single component with a `role` prop. On mount calls `getAgentContext(role, userId)`. Renders:
- Scope statement banner (top): list of available tools, system-prompt hint.
- Chat history (middle): each message has a RiskBadge.
- Input box (bottom): textarea + send button.

On send:
1. Write `chat_request` audit row.
2. Call `electronAPI.python.call('/ai-task', { prompt, role, tools })` — Day 2 stub returns canned responses based on keyword match.
3. Risk-classify the response (default `chat_response` LOW; if a tool was invoked, use that tool's risk tier).
4. If tier is HIGH: call `proposeAction(...)` instead of rendering directly. Render a placeholder bubble: "Action queued for admin approval" and update via subscription when approved.
5. Write `chat_response` (or `tool_invoked` / `action_proposed` / `request_refused`) audit row.

Mount on the student dashboard (replaces or sits beside the existing app icons grid). Add an **ASSISTANT** sidebar item on the admin Dashboard that mounts the same component with `role="admin"`.

### 6.7 Approvals Queue panel (`src/app/components/agentic/ApprovalsQueue.tsx`)

New admin sidebar item between AUDIT and SETTINGS. Reads from `listPending()` on mount + on a 5s poll (or via IPC subscription). Renders each request as a card per `demo-script.md` Segment 4. Approve/Reject buttons call `approveRequest`/`rejectRequest`.

The sidebar item shows a red badge with the count of pending entries — drives presenter attention during demo.

### 6.8 Stage controls (Day 2 queue smoke → Day 4 canonical USB)

**Day 2:** Optional **"Trigger HIGH action"** on the admin Dashboard to populate the Approvals Queue without USB hardware, e.g.:

```ts
proposeAction({
  type: 'wipe_terminal',
  scope: 'session',
  reversible: false,
  payload: { pcId: 'C08-PC01' },
  confidence: 1.0,
  reasoning: 'Stage trigger — manual admin override request.',
}, 'admin@runa.edu.ph', 'admin');
```

**Day 4 (stakeholder decision, 2026-05-03):** The **hardware fallback** for the canonical demo must be **production-level** — a first-class **"Simulate USB"** (or equivalent) that feeds the same orchestrator and audit trail as a real insertion. **Avoid** a visibly "debug-only" or `NODE_ENV === 'development'` affordance on the defense path; narrate Plan B honestly, but make it look like shipped product UI.

---

### 6.9 Real `/ai-task` wiring (Day 3)

Extend the Python service's `/ai-task` to accept `{ prompt, role, tools }`. If `GROQ_API_KEY` is present, call Groq with the role-specific system prompt + tool whitelist. Else return a canned response keyed by the prompt's first verb.

Renderer-side: replace the canned responses in `ProductivityAssistant` with real `electronAPI.python.call('/ai-task', ...)` calls. 5-second timeout — on timeout, render a labeled fallback message.

### 6.10 Real ClamAV `/scan-file` integration with the agent

Already planned in §3.4. Day 3 modification: after a successful scan with a detected threat, trigger the canonical agentic flow programmatically:

```ts
const action: AgentAction = {
  type: 'quarantine_usb', // or 'wipe_file' for files
  scope: 'session',
  reversible: false,
  payload: { path: scanPath, sha256: result.sha256, threat: result.threat },
  confidence: 0.95, // ClamAV signature matches are high-confidence
  reasoning: `ClamAV detected ${result.threat} (rule R12: threat detected + irreversible)`,
};
await proposeAction(action, currentUserId, currentRole);
```

This is what produces the audit chain `action_proposed → action_approved → action_executed`.

### 6.11 USB enumeration `/usb-list` (Day 3)

Python service exposes `GET /usb-list` returning currently-mounted removable devices. Renderer mounts a small "USB Devices" sub-panel on `LabMonitoringPanel`. On Day 4 the canonical scenario hooks USB events into the agentic flow.

---

### 6.12 Action Timeline component (Day 4)

`src/app/components/agentic/ActionTimeline.tsx` — renders a horizontal three-stage timeline:

```
▸ Perception   ✓ 21:34:05  USB inserted (SanDisk 16GB)
▸ Reasoning    ✓ 21:34:07  ClamAV detected Eicar-Test-Signature
▸ Action       ⏳ 21:34:09  HIGH → escalated to admin queue
```

Receives events via a context (`AgenticEventBus`) populated by the orchestrator. Each stage transitions through pending → active (spinner) → complete. Mount on the student dashboard as a slide-up panel triggered by the first perception event.

### 6.13 Canonical scenario orchestrator (`src/app/agentic/scenarios/usbInsertion.ts`)

Coordinates the full USB → quarantine flow:

1. Subscribe to `electronAPI.on('usb-inserted', ...)` (real pyusb event OR stage button dispatch).
2. Push perception event to `AgenticEventBus`.
3. Call `electronAPI.python.call('/scan-file', { path: usbMountPoint })`.
4. Push reasoning event with progress, then result.
5. Build the AgentAction, call `proposeAction(...)`.
6. Push action event with "escalated to queue" status.
7. Subscribe to approval state changes; on approve, push final "executed" stage and show toast.

### 6.14 Wire admin override actions through the queue (Day 4)

The original §4.2–§4.5 work for Lock Cluster / Terminate / WIPE TERMINAL changes shape: instead of directly calling `policy.set` + `audit.log`, those buttons now call `proposeAction` with the appropriate `AgentAction`. Since these are HIGH actions, they go through the queue.

Sprint lock (2026-05-05): demonstrate true two-party approval using separate devices/accounts (student proposes, admin approves). Avoid same-actor proposer/approver in the canonical run.

Kiosk Mode toggle is MEDIUM (reversible, single-machine), and for this sprint MEDIUM is also routed through HITL.

Additionally, remove any "stub executed successfully" fallback for sensitive actions in main; unimplemented sensitive actions must hard-fail with explicit reason text.

### 6.15 Governance affordances (Day 4)

Five small UI elements per `agentic-architecture.md` §8:

1. **Consent banner.** Modal on first launch, dismissed via `electron-store` flag `consent_given`. On accept, call `electronAPI.audit.log('consent_given', userId, userId)`.
2. **Governance footer.** Slate strip in the layout shell — `<GovernanceBanner />` component, always rendered.
3. **Audit Trails Data Minimization tooltip.** Add an `<InfoTooltip>` next to the Export button.
4. **Productivity Assistant scope statement.** Banner above chat input listing `availableTools.map(t => t.label)`.
5. **Settings → Privacy panel.** New tab in `SettingsPanel` listing the seven items from §8.

### 6.16 HITL audit row schema extensions (Day 4)

Extend the audit row interface in `electron/db.ts` (or the electron-store equivalent) with the optional fields per `agentic-architecture.md` §6. All new fields are optional so existing rows don't need migration. Update `AuditTrailsPanel` to render the new columns when populated.

---

## §7 Definition of Done — Tier 0

When all 9 items in `agentic-architecture.md` §13 pass, the agentic spine is shipped. Re-read that section before tagging `day-4-green`.

---

## Cross-cutting tips

- **Always run `npm run build:electron` after editing `electron/*.ts`** — the dev script does it for you on launch, but if you only edit while the app is running, you must restart Electron.
- **Renderer hot-reload still works** for files under `src/`. Editing `electron/*` requires Electron restart.
- **DevTools console** is your friend for IPC errors. Open Network tab to see `python:call` errors.
- **Keep the Python service terminal visible** during dev — it logs every request.
- **Whenever in doubt, branch to `decision-tree.md`.** It tells you which fallback to take and how to recover.
- **`agentic-architecture.md` is the source of truth** for risk tiers, tool whitelists, and HITL behavior. If §6 above contradicts it, the architecture doc wins — fix this file.
