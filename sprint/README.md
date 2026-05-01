# 5-Day Demo Sprint — PCU Lab Portal (RUNA)

> **Goal:** Ship a runnable, demoable **desktop** build of the PCU Lab Portal in 5 calendar days, covering the core student + admin flows end-to-end.

---

## What "demoable" means here

A grader / panelist sits at a Windows laptop, watches us double-click an icon (or run one command), and sees:

1. A **frameless desktop window** (not a browser tab) opens with the RUNA login.
2. **Admin login** lands on the admin console; the four panels (Lab Dashboard, Lab Monitoring, Access Control, Audit Trails) are populated and interactive.
3. **At least one security action is real**, not a mock — clicking it round-trips through the Python sidecar and shows a result.
4. **At least one persisted record** is real — restarting the app preserves session and writes an audit-log row.
5. **Student login** lands on the kiosk dashboard; session timer ticks; logout (or kiosk timeout) returns to the login screen.
6. **Window controls work** (custom titlebar drag, min/max/close), tray icon present, single-instance behavior enforced.

Anything beyond the above is bonus and explicitly **descoped** below.

---

## In scope (must-have for demo)

- Electron main + preload wired to the existing React UI.
- Custom titlebar + frameless window + kiosk toggle.
- Session persistence via `electron-store`.
- A working IPC bridge (`window.electronAPI.*`).
- One real security round-trip via the Python service (`/scan-file` **or** `/scan-usb`).
- Audit-log persistence (SQLite if `better-sqlite3` builds, else JSON via `electron-store`).
- Hard-coded "demo accounts" for student + admin login (no Cognito).
- Local dev launch (`pnpm dev`) works reliably end-to-end.

## Out of scope (explicitly cut for the 5-day window)

- AWS Cognito auth.
- Real Amazon Bedrock / Claude calls (canned response is fine).
- ClamAV install on the demo machine (stub scan acceptable — see `decision-tree.md`).
- Production Windows installer via `electron-builder` (nice-to-have on Day 5; portable zip is acceptable fallback).
- Real USB hardware enumeration on Windows (stub list acceptable).
- DynamoDB / S3 / QuickSight integration.
- Auto-start on boot, code signing, auto-update.

---

## Reading order

| File | What it gives you |
|---|---|
| [`roadmap.md`](./roadmap.md) | High-level 5-day plan with milestones and exit criteria per day |
| [`steps.md`](./steps.md) | The full ordered series of concrete steps (copy-pasteable commands, file diffs) |
| [`daily-checklist.md`](./daily-checklist.md) | Tickable to-do list for each of the 5 days — use this during the sprint |
| [`decision-tree.md`](./decision-tree.md) | Mermaid decision trees for every known gap / risk + the fallback we take |
| [`demo-script.md`](./demo-script.md) | The actual minute-by-minute demo walkthrough we will perform |

---

## Status snapshot (Day 0 — entering the sprint)

| Layer | State |
|---|---|
| React UI (login, access code, admin dashboard with 4 panels, student dashboard, settings, notifications) | **Done** — visually complete with mock data |
| `electron/main.ts`, `electron/preload.ts`, `electron/db.ts` | **Written but not buildable** — deps not in `package.json`, no scripts wired |
| `python-service/service.py` | **Written, not yet spawned** — has graceful stubs for missing libs |
| `package.json` | **Renderer deps only** — missing `electron`, `electron-store`, `axios`, `better-sqlite3`, `electron-builder`, `concurrently`, `wait-on`, `cross-env` |
| Real auth | **Not implemented** — `LoginPage` just `navigate(...)`s |
| Real persistence | **Not connected** — DB schema exists, never called from IPC |
| Tray icon asset | **Missing** — `src/imports/image.png` is referenced by `electron/main.ts` but not present |

This snapshot drives every fallback in `decision-tree.md`. **Read that file before starting Day 1.**

---

## Success criteria checklist (review at the end of Day 5)

- [ ] `pnpm dev` opens an Electron window with the RUNA login.
- [ ] Logging in as `admin@runa.edu.ph` lands on the admin Dashboard.
- [ ] Logging in as `student@runa.edu.ph` lands on the Student Dashboard.
- [ ] Closing and re-opening the app preserves the logged-in session (when "Persistent Session" is checked).
- [ ] Clicking **Scan File** in the admin console opens a native file picker, the Python service responds, and a notification toast appears.
- [ ] **Audit Trails** shows at least one row that was written by a real action during the demo (not seed data).
- [ ] **Lock Cluster** / **Terminate All Sessions** modals confirm and write an audit row.
- [ ] Toggling **Kiosk Mode** in Settings actually changes the window behavior.
- [ ] Custom titlebar drag + minimize/maximize/close all work.
- [ ] System tray icon appears with at least Show/Quit menu items.
- [ ] Demo runs in **≤ 10 minutes** without an unrecovered crash.

If all 10 are checked, we ship. If 8/10 are checked the day before demo, freeze scope and rehearse.
