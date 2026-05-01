# Daily Checklist

Tick boxes as you go. Each day ends when its **Exit Criterion** passes. If you can't pass it by EOD, jump to `decision-tree.md` instead of pushing into the next day.

> Time budgets are guidance — the **exit criterion** is the only thing that gates progress.

---

## Day 1 — Foundation (Make it boot as a desktop app)

**Exit criterion:** Frameless Electron window opens with the RUNA login. Drag, min, max, close all work.

### Morning (≈ 4 h)
- [ ] Read `sprint/README.md` and `sprint/decision-tree.md` end-to-end.
- [ ] `pnpm install` — verify the existing renderer deps install cleanly.
- [ ] `pnpm dev:vite`-equivalent (currently `pnpm dev`) loads in the browser at `localhost:5173`. Confirm the React UI works in a browser tab first — that's our baseline.
- [ ] Add Electron run-time deps: `pnpm add electron@^31 electron-store@^8 axios@^1`.
- [ ] Decide on SQLite path now. If yes: `pnpm add better-sqlite3@^11` and `pnpm add -D @types/better-sqlite3`. If unsure → defer (decision-tree §2 — fallback to electron-store JSON).
- [ ] Add dev deps: `pnpm add -D electron-builder concurrently wait-on cross-env`.

### Midday (≈ 2 h)
- [ ] Patch `package.json` per `steps.md` §1.2 (add `main`, scripts, `build` block).
- [ ] Add a placeholder `src/imports/image.png` (256×256, any solid color) **or** remove the `icon:` lines from `electron/main.ts`.
- [ ] Add `"noUnusedLocals": false, "noUnusedParameters": false` to `tsconfig.electron.json`.
- [ ] Run `pnpm build:electron` — fix any TS errors that surface.

### Afternoon (≈ 4 h)
- [ ] Comment out `startPythonService()` inside `app.whenReady()` in `electron/main.ts`. (Re-enabled Day 3.)
- [ ] First boot: `pnpm dev`. Vite serves; Electron launches; window shows the RUNA login.
- [ ] Verify titlebar drag.
- [ ] Verify min / max / close buttons.
- [ ] Verify tray icon shows in the Windows notification area.
- [ ] Verify single-instance lock (try `pnpm dev` in a second terminal — should focus existing window, not open a new one).
- [ ] DevTools console — confirm there are zero red errors at idle.
- [ ] Commit + tag `day-1-green`.

### Found-during-the-day notes (filled in after execution)
- **Toolchain:** `pnpm` not installed on this machine; switched to `npm` (existing `package-lock.json` confirms npm is the right call). All `pnpm` commands in `steps.md` map 1:1 to `npm` equivalents — `pnpm add X` → `npm install --save X`, `pnpm add -D X` → `npm install --save-dev X`, `pnpm dev` → `npm run dev`.
- **Electron in `dependencies` not `devDependencies`:** the existing `package.json` had `electron` under `dependencies` (not ideal — should be devDep so `electron-builder` doesn't try to bundle it). Left as-is for Day 1; revisit on Day 5 if packaging size is bloated.
- **`better-sqlite3` deferred (decision-tree §2):** to keep Day 1 native-compile-free, we excluded `electron/db.ts` from `tsconfig.electron.json` and committed to Path B (electron-store JSON for audit log) on Day 3. If the demo machine has VS Build Tools by then we can revisit Path A.
- **Tray icon asset not present:** `electron/main.ts` was hardened with a `HAS_ICON` guard. Tray creation is now skipped (with a console warning) when `src/imports/image.png` is missing. Window opens with Electron's default icon.
- **Path bug fixed:** `path.join(__dirname, "..", "src/imports/image.png")` only walked one level out of `dist-electron/`. Corrected to `..", ".."` so the icon will resolve once we drop the PNG in on Day 4.
- **`db.js` lingered after first compile:** TypeScript's incremental cache emitted it before the exclude took effect. `rm -rf dist-electron && npm run build:electron` cleans it. Add a `prebuild:electron` cleanup script later if it recurs.
- **DevTools "Autofill.enable failed" errors:** harmless internal Chromium DevTools chatter, ignore.

### Manual verification still required (do these with the window open)
- [ ] Window shows the RUNA login (visible title says "PCU Lab Portal" in the custom titlebar; "RUNA" watermark on page).
- [ ] Drag the custom titlebar — window moves.
- [ ] Click minimize (–) — window minimizes.
- [ ] Click maximize (□) — window fills the screen / restores.
- [ ] Click close (✕) — window closes; `npm run dev` exits the electron process (Vite stays up).
- [ ] Run `npm run dev` in a second terminal — second instance should immediately exit and the first window should focus (single-instance lock).

### Day 1 commit & tag (after manual verification passes)
```bash
git add -A
git commit -m "sprint d1: electron boots with React UI"
git tag day-1-green
```

---

## Day 2 — Auth + Session

**Exit criterion:** Closing and re-opening the app preserves the logged-in session (when "Persistent Session" is checked). Logout from dropdown OR tray returns to `/`.

### Morning (≈ 3 h)
- [ ] Create `src/app/auth/demoUsers.ts` with the two demo accounts (`steps.md` §2.1).
- [ ] Wire `LoginPage.tsx` `handleSignIn` to authenticate + call `electronAPI.session.set` (§2.2).
- [ ] Add a `loginError` state + visible error message under the form.
- [ ] Manual test: invalid creds → message; valid admin creds → `/dashboard`; valid student creds → `/student-dashboard`.

### Midday (≈ 2 h)
- [ ] Refactor `Root.tsx` into a `SessionGuard` (§2.3).
- [ ] Manual test the four scenarios in §2.7 (login → reopen, logout → reopen).

### Afternoon (≈ 3 h)
- [ ] Wire admin Logout button (`Dashboard.tsx`) to `session.clear` (§2.4).
- [ ] Wire student Logout button (`StudentDashboard.tsx`) to `session.clear`.
- [ ] Add tray "Logout" menu item in `electron/main.ts` that clears the session and sends `navigate("/")` (§2.5).
- [ ] Subscribe to `electronAPI.on("navigate", ...)` in `Root.tsx` so the tray nav works.
- [ ] (Optional) Add a "Force expire session in 30 s" debug button for stage demo (§2.6).
- [ ] Commit + tag `day-2-green`.

### Found-during-the-day notes
- ...

---

## Day 3 — Sidecar + Persistence

**Exit criterion:** Picking a file from the OS file picker shows a result toast. The audit row for that scan appears in Audit Trails after refresh, and survives an app restart.

### Morning (≈ 3 h)
- [ ] Re-enable `startPythonService()` in `electron/main.ts`.
- [ ] Verify `python --version` runs in the same shell that runs `pnpm dev`. If not → swap to `py` or absolute path.
- [ ] Install Python deps: `cd python-service && pip install flask boto3 python-clamd watchdog requests pyusb && cd ..`. (clamd / pyusb may fail to import — that's fine.)
- [ ] Launch `pnpm dev` — Python service should print `[python] PCU Lab Portal service starting on port 5001` in the Electron terminal.
- [ ] Hit `http://localhost:5001/health` from a browser → JSON response.

### Midday (≈ 3 h)
- [ ] Extend `python:call` IPC handler in `main.ts` to support GET (or add a separate `python:get` handler) — needed for `/health`.
- [ ] Build `<HealthDot />` and mount it in the admin TopBar (§3.3).
- [ ] Confirm green dot within 10 s of launch.
- [ ] Add the **Run File Scan** action (§3.4):
  - [ ] Tile in `AccessControlPanel.tsx` next to "Lock Cluster".
  - [ ] Click → file picker → POST to `/scan-file` → toast.
  - [ ] Tray notification fires too.

### Afternoon (≈ 4 h)
- [ ] Persistence — choose path (decision-tree §2):
  - **Path A — SQLite:**
    - [ ] Add `audit:log` and `audit:list` IPC handlers in `main.ts` (§3.5).
    - [ ] Extend `preload.ts` `audit` namespace + typings in `src/types/electron.d.ts`.
  - **Path B — electron-store JSON:**
    - [ ] Replace `db.ts` calls with `electron-store`-backed equivalents (§3.5b).
    - [ ] Same IPC + typings extensions.
- [ ] Call `audit.log("login", ...)` after successful login.
- [ ] Call `audit.log("file_scan", ...)` after every scan.
- [ ] Update `AuditTrailsPanel.tsx` to fetch `audit.list(100)` on mount and merge with seed rows (or replace seed rows entirely).
- [ ] Smoke test §3.6.
- [ ] Commit + tag `day-3-green`.

### Found-during-the-day notes
- ...

---

## Day 4 — Integration + Polish

**Exit criterion:** Full demo script (`demo-script.md`) runs cleanly in dev mode without devtools open. Every demo button does its real action or a clearly labeled "demo stub" toast.

### Morning (≈ 3 h)
- [ ] Replace random data in `LabDashboardPanel.tsx` with deterministic `STATIC_GRIDS` (§4.1).
- [ ] Same for `LabMonitoringPanel.tsx` and `AccessControlPanel.tsx`.
- [ ] Verify rehearsal-stable: refresh 3× and the same alert PCs appear in the same positions.

### Midday (≈ 3 h)
- [ ] Add `policy:get` and `policy:set` IPC handlers + preload + typings.
- [ ] Wire **Lock Cluster** confirm modal to call `policy.set` + `audit.log` (§4.2). On panel mount, hydrate `locked` state from `policy.get`.
- [ ] Wire **Terminate All Sessions** to call `audit.log` + show toast (§4.3).
- [ ] Wire **WIPE TERMINAL** alert button (§4.5).
- [ ] Wire **Kiosk Mode** toggle in `SettingsPanel.tsx` (§4.4).
- [ ] Add `globalShortcut` `Ctrl+Shift+K` escape hatch in `main.ts`. **Test it.**

### Afternoon (≈ 4 h)
- [ ] Lift `useNotifications` into a Context provider in `App.tsx` so `pushToast` works from any panel (§4.7).
- [ ] Add student session expiry hard-stop (§4.6).
- [ ] **Full dry run #1** of `demo-script.md`. Time it. Note every snag below.
- [ ] Fix top 3 snags.
- [ ] **Full dry run #2.** Time it.
- [ ] Commit + tag `day-4-green`.

### Found during dry run
- (e.g. "Audit trails table broke with empty seed list", "Health dot races on cold boot", …)
- ...

---

## Day 5 — Build + Rehearse

**Exit criterion:** Hand laptop to a stranger, they double-click `RUNA.exe` (or `run-demo.bat`), full demo script completes ≤ 10 min without an unrecovered crash.

### Morning (≈ 3 h)
- [ ] (Optional) `pnpm build:win` to produce a portable `.exe`.
  - [ ] If `better-sqlite3` rebuild fails: `pnpm rebuild:native && pnpm build:win`.
  - [ ] If still fails: skip — we go dev-mode launcher only.
- [ ] Test the portable `.exe` on the actual demo laptop. Note antivirus warnings.
- [ ] Author `run-demo.bat` (§5.2) as primary or backup launcher.
- [ ] Author `README-DEMO.md` — one-page launch instructions for whoever runs the laptop.

### Midday (≈ 3 h)
- [ ] **Rehearsal #1** — straight read of `demo-script.md`. Time it. Fix snags.
- [ ] **Rehearsal #2** — partner watches and grades pacing. Fix snags.
- [ ] **Rehearsal #3** — recorded with screen capture. This is the backup video.

### Afternoon (≈ 3 h)
- [ ] Pack USB / zip with: `run-demo.bat`, portable `.exe` (if any), `python-service/`, `README-DEMO.md`, `backup-demo.mp4`.
- [ ] Reboot the demo laptop. Plug only the demo USB. Run cold from scratch — does it work?
- [ ] Charge the laptop to 100 %. Disable Windows Update. Disable sleep mode.
- [ ] Pre-stage the Electron window full-screen on the lab projector at the demo venue if possible.
- [ ] Write a 5-bullet "talk track" cue card and tape it to the laptop bezel.
- [ ] Commit + tag `demo-ready`.

### Day-of demo prep (morning of demo)
- [ ] Run a single warm-up rehearsal 30 min before stage time.
- [ ] Confirm `/health` is green before the panel arrives.
- [ ] Have the backup video on a second window (Alt+Tab away) ready to play.
- [ ] Breathe. You've rehearsed three times.

---

## Acceptance review (do this with a partner before tagging `demo-ready`)

- [ ] **README success criteria** — all 10 boxes in `sprint/README.md` checked.
- [ ] **Demo script** — runs in 8 min ± 1 in three consecutive rehearsals.
- [ ] **Recovery plan** — every "Plan B" in `decision-tree.md` has been verified at least once.
- [ ] **Bus-factor** — at least two team members can launch the demo.

If any of these fail, **don't tag `demo-ready`**. Loop on rehearsals or descope further.
