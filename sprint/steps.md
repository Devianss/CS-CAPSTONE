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
pip install flask boto3 python-clamd watchdog requests pyusb
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

### 5.1 (Optional) Produce a portable `.exe`

```bash
pnpm build:win
```

Expected output: `release/PCU Lab Portal-1.0.0-portable.exe`. Test it on the demo machine. If `better-sqlite3` rebuild fails, run:

```bash
pnpm rebuild:native
pnpm build:win
```

If it still fails, ship the dev-mode launcher instead (§5.2).

### 5.2 Dev-mode launcher (fallback or primary)

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

## Cross-cutting tips

- **Always run `pnpm build:electron` after editing `electron/*.ts`** — the dev script does it for you on launch, but if you only edit while the app is running, you must restart Electron.
- **Renderer hot-reload still works** for files under `src/`. Editing `electron/*` requires Electron restart.
- **DevTools console** is your friend for IPC errors. Open Network tab to see `python:call` errors.
- **Keep the Python service terminal visible** during dev — it logs every request.
- **Whenever in doubt, branch to `decision-tree.md`.** It tells you which fallback to take and how to recover.
