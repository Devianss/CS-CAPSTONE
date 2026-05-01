# Roadmap — 5-Day Demo Sprint

This is the **strategic** view. For per-task granular instructions see `steps.md`; for tickable to-dos see `daily-checklist.md`.

---

## At-a-glance

```
Day 1  ─── Foundation ──────────────  Electron actually boots
Day 2  ─── Auth + Session ──────────  Login → role routing → persistent session
Day 3  ─── Sidecar + Persistence ──  Python service round-trip + audit log writes
Day 4  ─── Integration + Polish ────  Lock/Terminate/Kiosk wired; demo data seeded
Day 5  ─── Build + Rehearse ────────  Package or portable; rehearse demo 3×
```

Each day has a single **non-negotiable exit criterion**. If a day's exit criterion is not met, **do not start the next day's work** — fall back to the corresponding branch in `decision-tree.md` and either (a) cut scope or (b) carry the gap into a documented limitation.

---

## Day 1 — Foundation

**Theme:** "Make the existing React UI run inside an Electron window."

### Deliverables
- `package.json` updated with all Electron-side dependencies and scripts.
- `pnpm dev` launches the Vite dev server **and** an Electron window pointed at it.
- Custom `TitleBar` drags the window; min/max/close work.
- System tray icon appears (placeholder asset accepted).
- Single-instance lock verified.
- Python service intentionally **not** spawned yet (commented out).
- `electron/db.ts` not yet wired (deferred to Day 3).

### Exit criterion
**A frameless Electron window opens with the RUNA login screen, and you can drag, minimize, maximize, and close it from the custom titlebar.**

### Risks addressed
- Missing Electron deps in `package.json`.
- `electron-store` v10 ESM-only mismatch with our CommonJS main process.
- Missing tray icon asset (`src/imports/image.png`).
- `noUnusedLocals` / strict TS errors when compiling `electron/`.

---

## Day 2 — Auth + Session

**Theme:** "Replace the placeholder `navigate(...)` with a real session round-trip through `window.electronAPI`."

### Deliverables
- `LoginPage` calls `electronAPI.session.set(...)` on submit, with hard-coded demo credentials:
  - `admin@runa.edu.ph` / `runa-admin` → role `admin` → `/dashboard`
  - `student@runa.edu.ph` / `runa-student` → role `student` → `/student-dashboard`
- A new `SessionGuard` (or inline check in `Root.tsx`) redirects unauthenticated visits away from `/dashboard` and `/student-dashboard`.
- `Logout` button (admin + student dropdowns) calls `electronAPI.session.clear()`.
- "Persistent Session" checkbox controls whether the session survives an app restart.
- Tray context menu gains a **Logout** option that clears the session and navigates to `/`.
- Renderer listens to `electronAPI.on("navigate", ...)` for tray-driven navigation (already whitelisted in `preload.ts`).

### Exit criterion
**Closing and re-opening the app keeps the user signed in (if "Persistent Session" was checked); otherwise it returns to the login screen. Logout from the dropdown OR from the tray returns to `/` immediately.**

### Risks addressed
- React Router 7 `RouterProvider` doesn't have a built-in auth loader — we'll do the check in `Root.tsx` with `useEffect` + `useNavigate`.
- The renderer might initialize before `electronAPI` is ready in some Electron versions — we'll use a tiny "session bootstrap" effect that resolves before children render.

---

## Day 3 — Sidecar + Persistence

**Theme:** "Make at least one thing real."

### Deliverables
- Python service spawns automatically on Electron startup (re-enable `startPythonService()` in `main.ts`).
- Health probe: a small badge in the admin TopBar polls `/health` every 10 s and shows green/red.
- **Real action #1 — Scan File:** new button in `AccessControlPanel` (or `LabMonitoringPanel`'s alert card) that:
  1. Calls `electronAPI.dialog.openFile()`,
  2. Calls `electronAPI.python.call('/scan-file', { path })`,
  3. Pushes a notification with the result.
- Audit-log persistence wired (one of two paths — choose per `decision-tree.md`):
  - **Path A (preferred):** `better-sqlite3` builds → call `db.logEvent(...)` from main; expose `audit:list` IPC; `AuditTrailsPanel` reads real rows alongside the seed data.
  - **Path B (fallback):** Persist a JSON array via `electron-store` under key `audit_log`; same IPC surface, different storage.
- Every successful login + every Scan File action writes one audit row.

### Exit criterion
**Picking a file from the OS file picker shows a result toast, and the row for that scan appears in Audit Trails after a refresh — and is still there after restarting the app.**

### Risks addressed
- `better-sqlite3` native compilation needing VS Build Tools.
- Python not on `PATH` on demo machine.
- ClamAV not installed → service falls through to the SHA-256 + "clean" stub, which is fine for demo (clearly labeled "stub" in the toast).
- Bedrock / AWS creds not configured → `/ai-task` left untouched on Day 3.

---

## Day 4 — Integration + Polish

**Theme:** "Make every demo-path button do *something* and seed the dashboards so they look alive."

### Deliverables
- `LabDashboardPanel` and `LabMonitoringPanel` show **deterministic** seed data (no `Math.random()` in render — see `steps.md` §4) so screenshots and rehearsals are reproducible.
- **Lock Cluster** confirm modal calls main → `setPolicy('comlab_08_locked', '1')` + `logEvent('cluster_locked', ...)`. UI badge stays "ACTIVE" across reload.
- **Terminate All Sessions** modal calls main → `clearAllSessions()` + `logEvent('mass_termination', ...)`. Toast confirms.
- **Kiosk Mode** toggle in `SettingsPanel` actually flips `mainWindow.setKiosk(...)`.
- **Tray notify** demo: clicking the alert card "WIPE TERMINAL" button fires `electronAPI.tray.notify(...)`.
- Student session timer enforces expiry: when 0:00:00 is reached, `session.clear()` and navigate to `/`.
- Add a real PNG at `src/imports/image.png` (or update path in `main.ts`) so the tray and window icon are not broken.
- Smoke-test the **full demo path** end to end (see `demo-script.md` Run #1).

### Exit criterion
**The complete demo script runs cleanly in dev mode without devtools open, and every button referenced in the demo script either does its real action or shows a clearly labeled "demo stub" toast.**

### Risks addressed
- Random data on each render breaks rehearsal predictability — seed deterministically.
- Kiosk mode locking the dev machine — bind a global escape (Ctrl+Shift+K or use the SettingsPanel toggle) to exit kiosk.
- Tray balloon notification only works on Windows — confirm demo machine is Windows.

---

## Day 5 — Build + Rehearse

**Theme:** "Make it portable, then rehearse until it's boring."

### Deliverables (build track)
- `electron-builder` config in `package.json` for a `--win portable` target.
- `pnpm build:win` produces `release/PCU Lab Portal x.x.x.exe` (portable single-file `.exe`).
- Smoke-test the portable build on the actual demo machine (or a clean Windows VM if available).

### Deliverables (rehearsal track)
- **3 full dry runs** of `demo-script.md`, timed.
- Slides / one-pager with screenshots (optional).
- A **fallback launcher script** (`run-demo.bat`) that runs `pnpm dev` so we always have a Plan B if the packaged `.exe` misbehaves on the demo laptop.
- Backup recording of a successful run (in case the live demo crashes — we still have something to show).

### Exit criterion
**You can hand the demo laptop to a stranger, tell them "double-click `RUNA.exe`," and the entire demo script (login → scan → audit → student kiosk → logout) completes without you touching the keyboard, in ≤ 10 minutes.**

### Risks addressed
- Native module rebuild for production (`electron-builder` runs `electron-rebuild`); if it fails on Day 5 we ship the portable dev launcher.
- Antivirus quarantining the unsigned `.exe` — instruct the demo operator to right-click → Run anyway, or fall back to dev launcher.
- Bundling the Python service with PyInstaller is **out of scope**; we ship `python service.py` as a side script and have the dev launcher start it.

---

## Sequencing rules

1. **Never start a day's work until the previous day's exit criterion passes.** If you're stuck, jump to `decision-tree.md`.
2. **Cut scope, never deadlines.** If Day 3 looks like it'll bleed into Day 4, drop the SQLite path and ship the JSON-via-`electron-store` fallback. Document the limitation.
3. **Commit at every green checkpoint.** Tag `day-1-green`, `day-2-green`, … so we can revert if Day 4 polish breaks Day 3 functionality.
4. **Keep one developer on rehearsal track from Day 4 afternoon onward**, even if Day 4 features are still in flight. The demo flow itself must be rehearsed.

---

## Stretch goals (only attempt if Day 4 finishes early)

- `/ai-task` integration with a canned local response (mock an "AI summary of today's audit log" that calls Bedrock if creds present, else returns a static string).
- Real USB scan via `pywinusb` on the demo machine.
- Auto-launch on login via `app.setLoginItemSettings(...)`.
- A second admin command — "Quarantine PC" — that calls `setPolicy` with the PC ID.

Anything not in the stretch list above is **post-thesis-demo work** and should not be touched during the sprint.
