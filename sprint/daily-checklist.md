# Daily Checklist

Tick boxes as you go. Each day ends when its **Exit Criterion** passes. If you can't pass it by EOD, jump to `decision-tree.md` instead of pushing into the next day.

> Time budgets are guidance — the **exit criterion** is the only thing that gates progress.

---

## Sprint progress (living)

| Milestone | Status | Notes |
|-----------|--------|--------|
| Day 1 | **Done** | Tag `day-1-green` — Electron shell, titlebar, session store baseline |
| Day 2 | **Done** | Tag `day-2-green` — Agentic types/classifier/registry, Approvals Queue, assistant (stub + risk), demo auth, `agent:*` + `audit:*` IPC |
| Day 3 | **Done** | Tag `day-3-green` — Sidecar spawn, `python:call` GET/POST, `/health` badge, `/ai-task`, `/scan-file`, `/usb-list`, login + file-scan audit, dual Audit Trails surface; **exit criteria manually verified on demo laptop** (2026-05-03) |
| Day 4 | **Next** | Canonical USB + **real** `executeAction`, Action Timeline, governance/consent (**real** copy), policy-backed overrides — see [`stakeholder-decisions.md`](./stakeholder-decisions.md) |
| Day 5 | Pending | **Portable `.exe` is the primary artifact**; `run-demo.bat` = Plan B only |

Granular unchecked boxes in older day sections are **archival**; use the table above plus each day’s **exit criterion** for gating.

---

## Day 1 — Foundation (Make it boot as a desktop app)

**Bulk status: complete** (tag `day-1-green`).

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

## Day 2 — Agentic Spine + Auth/Session

**Bulk status: complete** (tag `day-2-green`).

**Exit criterion:**
1. Student logs in, opens Productivity Assistant, sends a message, receives a response with a LOW Risk Badge.
2. Stage "Trigger HIGH action" button creates an Approvals Queue entry.
3. Admin logs in, sees red badge on APPROVALS QUEUE sidebar, approves the entry, action executes.
4. Closing and reopening the app preserves session AND pending queue entries.

> Cross-reference: `steps.md` §6.1–§6.8 for the agentic spine, §2 for auth. `agentic-architecture.md` §3–§5 for design.

### Morning (≈ 4 h) — Agentic types + risk classifier + tool registry
- [ ] Create `src/app/agentic/types.ts` per `steps.md` §6.1.
- [ ] Create `src/app/agentic/riskClassifier.ts` per §6.2. Unit-test by hand: `classifyAction({type:'wipe_terminal',...})` → `'high'`; `classifyAction({type:'chat_response', confidence: 0.5})` → `'medium'`.
- [ ] Create `src/app/agentic/toolRegistry.ts` per §6.3.
- [ ] Create `src/app/agentic/approvalQueue.ts` (renderer wrapper) per §6.4.

### Morning (≈ 2 h, parallel) — Auth/Session
- [ ] Create `src/app/auth/demoUsers.ts` with the two demo accounts (`steps.md` §2.1).
- [ ] Wire `LoginPage.tsx` `handleSignIn` to authenticate + call `electronAPI.session.set` (§2.2).
- [ ] Add a `loginError` state + visible error message under the form.
- [ ] Manual test: invalid creds → message; valid admin creds → `/dashboard`; valid student creds → `/student-dashboard`.

### Midday (≈ 3 h) — Approval queue (main side)
- [ ] Add `agent:propose`, `agent:list-pending`, `agent:approve`, `agent:reject`, `agent:request-info` IPC handlers in `electron/main.ts` per §6.4.
- [ ] Add `agent` namespace to `electron/preload.ts`.
- [ ] Add typings to `src/types/electron.d.ts`.
- [ ] Refactor `Root.tsx` into a `SessionGuard` (§2.3) — also subscribes to `electronAPI.on("navigate", ...)`.

### Afternoon (≈ 4 h) — UI components
- [ ] Build `<RiskBadge />` (§6.5) — used everywhere risk surfaces.
- [ ] Build `<ProductivityAssistant />` (§6.6) — single component, `role` prop. Stub backend: switch on prompt keywords ("explain", "summarize", "delete" → refusal templated message).
- [ ] Mount student-mode assistant on `StudentDashboard.tsx` (replace or sit beside the app icons grid).
- [ ] Add **ASSISTANT** sidebar item to admin `Dashboard.tsx`. Mount admin-mode assistant.
- [ ] Build `<ApprovalsQueue />` (§6.7). Add **APPROVALS QUEUE** sidebar item between AUDIT and SETTINGS, with red-badge count of pending entries.
- [ ] Add stage **Trigger HIGH action** debug button (§6.8) under `NODE_ENV === 'development'` guard.
- [ ] Wire admin/student logout buttons to `session.clear` (§2.4) + tray Logout menu (§2.5).

### Late afternoon (≈ 1 h) — Smoke test
- [ ] Login student → Assistant → "Explain Big-O notation" → response with LOW badge.
- [ ] Type "Delete C:\\Windows\\System32" → refusal template, also LOW badge.
- [ ] Logout, login admin → click stage **Trigger HIGH action** → Queue badge shows "1".
- [ ] Open APPROVALS QUEUE → see request → click Approve → toast confirms execution.
- [ ] Audit Trails shows `action_proposed`, `action_approved`, `action_executed` rows linked by approvalId.
- [ ] Restart app → pending queue (if any) and session both persist.
- [ ] Commit + tag `day-2-green`.

### Found-during-the-day notes
- **IPC names:** implemented channel is `agent:propose` (not `agent:request`); includes `agent:list-history` and `agent:request-info`.
- **Queue + audit:** HIGH proposals persist in `electron-store`; `action_proposed` / `action_approved` / `action_executed` rows share `approvalId` (main-process `logEvent`).
- **`executeAction`:** still a **stub** in main until Day 4 — stakeholder requires **real** side effects next sprint.
- **Assistant:** Day 2 used keyword stub; Day 3 added **`POST /ai-task`** with sidecar fallback text when Python is unreachable.

---

## Day 3 — Real Wiring (Python sidecar live)

**Bulk status: complete** (tag `day-3-green`).

**Exit criterion:**
1. Picking a file from the OS file picker shows a real ClamAV (or stub) result toast and writes an audit row that survives restart.
2. Sending a chat message to the assistant calls real `/ai-task` and the response is rendered.
3. USB devices currently plugged appear in the new USB sub-panel.
4. Audit Trails shows HITL columns populated for any approval from Day 2.

> Cross-reference: `steps.md` §3 (sidecar + persistence) and §6.9–§6.11 (real `/ai-task`, ClamAV→agent, USB enum).

### Morning (≈ 2 h) — Sidecar boot
- [ ] Re-enable `startPythonService()` in `electron/main.ts`.
- [ ] Verify `python --version` runs in the same shell that runs `npm run dev`. If not → swap to `py` or absolute path.
- [ ] Install Python deps: `cd python-service && pip install flask boto3 python-clamd watchdog requests pyusb && cd ..`. (clamd / pyusb may fail to import — that's fine.)
- [ ] Launch `npm run dev` — Python service should print `[python] PCU Lab Portal service starting on port 5001` in the Electron terminal.
- [ ] Hit `http://localhost:5001/health` from a browser → JSON response.

### Midday (≈ 3 h) — Health badge + real `/ai-task` + ClamAV
- [ ] Extend `python:call` IPC handler in `main.ts` to support GET — needed for `/health` and `/usb-list`.
- [ ] Build `<HealthDot />` and mount it in the admin TopBar (§3.3).
- [ ] Wire `<ProductivityAssistant />` to call real `/ai-task` with `{prompt, role, tools}` (§6.9). 5s timeout falls back to a labeled static response.
- [ ] Extend `python-service/service.py` `/ai-task` to accept role + tools and build a Bedrock call if creds present, else canned response.
- [ ] Add the **Run File Scan** action (§3.4):
  - [ ] Tile in `AccessControlPanel.tsx` next to "Lock Cluster".
  - [ ] Click → file picker → POST to `/scan-file` → toast.
  - [ ] If threat detected, programmatically call `proposeAction({type:'quarantine_usb',...})` (§6.10) — produces the audit chain.
  - [ ] Tray notification fires too.

### Afternoon (≈ 3 h) — USB enumeration
- [ ] Python: implement `GET /usb-list` returning currently-mounted removable devices (pyusb).
- [ ] Renderer: add a small "USB Devices" sub-panel on `LabMonitoringPanel.tsx` polling `/usb-list` every 5s.
- [ ] (Optional, time-permitting) Implement `POST /usb-quarantine` that unmounts + logs the device serial. Stub if pyusb permissions block.

### Afternoon (≈ 3 h) — Persistence
- [ ] Persistence — choose path (decision-tree §2):
  - **Path A — SQLite:**
    - [ ] Add `audit:log` and `audit:list` IPC handlers in `main.ts` (§3.5).
    - [ ] Extend `preload.ts` `audit` namespace + typings in `src/types/electron.d.ts`.
  - **Path B — electron-store JSON (default):**
    - [ ] Replace `db.ts` calls with `electron-store`-backed equivalents (§3.5b).
    - [ ] Same IPC + typings extensions.
- [ ] Extend audit row schema with HITL fields (`approvalId`, `approverUserId`, `riskTier`, `confidenceScore`) — additive (§6.16).
- [ ] Call `audit.log("login", ...)` after successful login.
- [ ] Call `audit.log("file_scan", ...)` after every scan (with `riskTier` populated).
- [ ] Update `AuditTrailsPanel.tsx` to fetch `audit.list(100)` and render the new HITL columns when populated.

### Late afternoon (≈ 1 h) — Smoke test
- [ ] Login admin → health dot green within 10s.
- [ ] Run File Scan on a `.txt` → toast with sha256 + audit row.
- [ ] Run File Scan on EICAR → threat detected + `action_proposed` queued.
- [ ] Open Approvals Queue → approve → action_executed row appears.
- [ ] Close + reopen app → all rows still there, queue still there.
- [ ] Send "Summarize today's audit" to admin Assistant → real Bedrock (or labeled static) response.
- [ ] USB sub-panel shows devices currently plugged in.
- [ ] Commit + tag `day-3-green`.

### Found-during-the-day notes
- **Networking:** Electron `python:call` targets **`127.0.0.1`** (avoids Windows `localhost` → `::1` vs Flask on IPv4).
- **Python path:** dev spawn resolves `python-service/service.py` from repo root (two levels above `dist-electron/electron/`).
- **Health poll:** UI uses **5s** interval (doc previously said 10s — both acceptable).
- **Toasts:** **Sonner** `<Toaster />` in `App.tsx` for scan flows; legacy in-dashboard notifications unchanged.
- **Audit Trails:** **RUNA agent / HITL log** tab calls `audit.list`; institutional attendance table remains **synthetic** for visuals until Tier 1 de-randomization (Day 4 carry-over).
- **Bedrock:** defense laptop expected to have creds (`stakeholder-decisions.md`); service returns **`local_fallback`** when AWS errors.
- **Next sprint hook:** replace `executeAction` stub with **production-level** behavior; add **polished** “Simulate USB” (not dev-only).

---

## Day 4 — Canonical Demo Flow + Governance

**Exit criterion:** Canonical USB scenario from `agentic-architecture.md` §7 runs end-to-end without code edits. PLUS 7+/9 of the Definition-of-Done items in §13 pass.

> Cross-reference: `steps.md` §6.12–§6.16 (Action Timeline + scenario orchestrator + override-via-queue + governance + HITL audit), §4 (carry-over Tier 1 polish + scheduling).

### Morning (≈ 3 h) — Action Timeline + canonical scenario
- [ ] Build `<ActionTimeline />` (`steps.md` §6.12). Renders three labeled stages with timestamps.
- [ ] Add `AgenticEventBus` context in `src/app/agentic/eventBus.tsx` so the orchestrator can push events without prop-drilling.
- [ ] Build `src/app/agentic/scenarios/usbInsertion.ts` orchestrator (§6.13).
- [ ] Mount `<ActionTimeline />` on the student dashboard as a slide-up panel triggered by the first perception event.
- [ ] Add stage **Simulate USB** button (admin-side, dev-only) that dispatches a fake `usb-inserted` event for fallback when hardware fails.

### Midday (≈ 3 h) — Override actions through the queue
- [ ] Add `policy:get` and `policy:set` IPC handlers + preload + typings.
- [ ] Refactor **Lock Cluster** confirm modal to call `proposeAction` (HIGH) instead of direct policy.set (§6.14). Action handler in main executes `policy.set` only on approval.
- [ ] Same for **Terminate All Sessions**.
- [ ] Same for **WIPE TERMINAL** alert button on `LabMonitoringPanel`.
- [ ] **Kiosk Mode** toggle (Settings) — auto-execute MEDIUM with audit row (§6.14 footer).
- [ ] Add `globalShortcut` `Ctrl+Shift+K` escape hatch in `main.ts`. **Test it.**

### Afternoon (≈ 3 h) — Governance affordances + Tier 1 polish
- [ ] Build `<ConsentBanner />` modal — shown on first launch when `electron-store` flag `consent_given` is missing. On accept: write `consent_given` audit row + set flag (§6.15.1).
- [ ] Build `<GovernanceBanner />` footer — always-rendered slate strip in the layout shell (§6.15.2).
- [ ] Add **Data Minimization** tooltip near Audit Trails Export (§6.15.3).
- [ ] Add scope statement banner above Productivity Assistant chat input (§6.15.4).
- [ ] Add **Privacy** sub-tab to `SettingsPanel.tsx` per §6.15.5.
- [ ] Lift `useNotifications` into a Context provider in `App.tsx` (§4.7).
- [ ] Add student session expiry hard-stop (§4.6).
- [ ] Replace random data in `LabDashboardPanel`, `LabMonitoringPanel`, `AccessControlPanel` with deterministic `STATIC_GRIDS` (§4.1).
- [ ] Apply Tier 1 frontend fixes: `min-h-screen → h-full`, z-index, kebab handlers per `frontend-audit-decisions.md`.
- [ ] (Folded in) COMLAB modular config + scheduling data model per `scheduling-architecture.md` if not already done.

### Late afternoon (≈ 1 h) — Dry runs
- [ ] **Full dry run #1** of `demo-script.md`, anchored on the canonical USB scenario. Time it. Note every snag below.
- [ ] Fix top 3 snags.
- [ ] **Full dry run #2.** Time it. Target 8 min ± 1.
- [ ] Walk through `agentic-architecture.md` §13 Definition-of-Done. Aim for 7+/9 passing.
- [ ] Commit + tag `day-4-green`.

### Found during dry run
- (e.g. "Action Timeline races on cold boot", "Bedrock latency too long without spinner", "Approval queue refresh lag", …)
- ...

---

## Day 5 — Build + Rehearse

**Exit criterion:** Hand laptop to a stranger, they double-click `RUNA.exe` (or `run-demo.bat`), full demo script completes ≤ 10 min without an unrecovered crash.

### Morning (≈ 3 h)
- [ ] (Optional) `npm run build:win` to produce a portable `.exe`.
  - [ ] If `better-sqlite3` rebuild fails: `npm run rebuild:native && npm run build:win`.
  - [ ] If still fails: skip — we go dev-mode launcher only.
- [ ] Test the portable `.exe` on the actual demo laptop. Note antivirus warnings.
- [ ] Author `run-demo.bat` (§5.2) as primary or backup launcher.
- [ ] Author `README-DEMO.md` — one-page launch instructions for whoever runs the laptop.
- [ ] (Stretch) Migrate audit log from electron-store JSON to SQLite (Path A). If risky, defer.
- [ ] (Stretch) Add chained row-hash integrity column to audit rows.

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
