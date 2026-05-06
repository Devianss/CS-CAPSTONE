# 5-Day Demo Sprint — PCU Lab Portal (RUNA)

> **Goal:** Ship a runnable, demoable **desktop** build of the PCU Lab Portal in 5 calendar days, covering the core student + admin flows end-to-end.

---

## What "demoable" means here

> **Reframed after reading the thesis rationale (`Agentic RPA Thesis Rationale.pdf`).** The thesis is scored on **bounded agentic behavior with HITL governance**, not UI completeness. The demo must showcase the agentic spine. See `agentic-architecture.md` for the canonical design.

A grader / panelist sits at a Windows laptop, watches us double-click an icon (or run one command), and sees:

1. A **frameless desktop window** (not a browser tab) opens with the RUNA login. Consent banner on first launch.
2. **Student login** lands on the kiosk; the **Productivity Assistant** is open with a clear scope statement and 5 academic tools. Every assistant response carries a **Risk Badge** (LOW/MED/HIGH).
3. **A USB insertion (or stage button) triggers the canonical agentic flow:** Perception → Reasoning (ClamAV scan) → Action (HIGH-risk → escalates to Approvals Queue). The **Action Timeline** renders the three stages on screen.
4. **Admin login** lands on the admin console; the **Approvals Queue** sidebar item shows a red badge with the pending HIGH-risk request. Admin reviews evidence + reasoning + risk tier and clicks **Approve**.
5. **Approval executes the action** (real ClamAV / real or simulated quarantine) and writes **linked audit rows** (`action_proposed`, `action_approved`, `action_executed`) bound by the same `approvalId`.
6. **Audit Trails** shows the new HITL columns populated. Restart the app — queue and audit rows persist.
7. **Admin Productivity Assistant** demonstrates the operational mode (5 admin tools); HIGH-risk proposals from the chat are queued (not auto-executed).
8. **Window controls work** (custom titlebar drag, min/max/close), tray icon present, single-instance behavior enforced.
9. **Governance footer** visible on every panel (retention period, role, RA 10173 posture).

Anything beyond the above is bonus and explicitly **descoped** below.

---

## In scope (must-have for demo)

**Agentic spine (thesis-critical):**
- Productivity Assistant chat panel, dual-mode (student + admin), 5 tools each, with system prompts.
- Risk classifier (deterministic rule table) producing LOW/MED/HIGH tiers on every agent action.
- Risk Badge component visible on every assistant response and queue entry.
- Approvals Queue with persisted in-memory + electron-store backing. HIGH actions BLOCK until admin approves.
- Action Timeline component rendering Perception → Reasoning → Action for the canonical USB scenario.
- Audit log with HITL extensions (`approvalId`, `approverUserId`, `riskTier`, `confidenceScore`).
- Consent banner on first launch + governance footer on every panel.

**Infrastructure:**
- Electron main + preload wired to the existing React UI.
- Custom titlebar + frameless window + kiosk toggle.
- Session persistence via `electron-store`.
- A working IPC bridge (`window.electronAPI.*`).
- Real `/scan-file` (ClamAV or stub), real `/ai-task` (Groq or canned), real or simulated `/usb-list`.
- Audit-log persistence (electron-store JSON default; SQLite if `better-sqlite3` builds).
- Hard-coded "demo accounts" for student + admin login (no Cognito).
- Local dev launch (`npm run dev`) works reliably end-to-end.

## Out of scope (explicitly cut for the 5-day window)

- AWS Cognito auth (sessions are local).
- Real Groq evaluation rigor (a single canned response per tool is acceptable as long as it's labeled).
- ClamAV install on the demo machine (stub scan with EICAR signature recognition acceptable).
- Production Windows **MSI installer** (still out of scope). **Portable `.exe` via electron-builder is in scope and is the primary Day 5 artifact** per stakeholder decision.
- DynamoDB / S3 / QuickSight integration; cross-machine queue federation.
- Auto-start on boot, code signing, auto-update.
- Tiered approval timeouts, multi-admin queue federation (Phase 2).
- Chained row-hash audit integrity (designed in `agentic-architecture.md` §6, stub now, real if Day 5 has time).

---

## Reading order

| File | What it gives you |
|---|---|
| [`agentic-architecture.md`](./agentic-architecture.md) | **Read first.** The canonical thesis-aware design: P-R-A cycle, risk tiers, HITL gates, dual-mode assistant, RA 10173 mapping, demo storyline, defense Q&A |
| [`roadmap.md`](./roadmap.md) | High-level 5-day plan with milestones and exit criteria per day (reordered to put agentic spine in Days 2–4) |
| [`steps.md`](./steps.md) | The full ordered series of concrete steps (copy-pasteable commands, file diffs). §6 covers the agentic spine |
| [`daily-checklist.md`](./daily-checklist.md) | Tickable to-do list for each of the 5 days — use this during the sprint |
| [`decision-tree.md`](./decision-tree.md) | Mermaid decision trees for every known gap / risk + the fallback we take |
| [`demo-script.md`](./demo-script.md) | The actual minute-by-minute demo walkthrough — re-anchored on the canonical USB-quarantine storyline |
| [`scheduling-architecture.md`](./scheduling-architecture.md) | Lab + scheduling data model (Tier 1 work, folded into Day 4) |
| [`frontend-audit.md`](./frontend-audit.md), [`frontend-audit-decisions.md`](./frontend-audit-decisions.md) | UI hygiene findings and tier decisions (Tier 1 work) |
| [`stakeholder-decisions.md`](./stakeholder-decisions.md) | **Locked decisions** after Day 3 (demo storyline, real execution, governance, Groq, `.exe` priority) |

---

## Status snapshot (**as of Day 4 in-progress + packaging prep** — 2026-05-06)

| Layer | State |
|---|---|
| React UI (login, dashboards, settings, notifications) | **Shipped** — integrated with Electron session and agentic panels |
| `electron/main.ts`, `electron/preload.ts` | **Shipped** — session, settings, window, `python:call` (GET/POST + timeout), dialog, tray, **audit:log / audit:list**, **agent:** queue + classify. **Next locked work:** remove sensitive success stubs, enforce truthful hard-fail, route MEDIUM through HITL. |
| `electron/db.ts` | **Excluded from build** — audit uses **Path B** (`electron-store` JSON), per `decision-tree.md` |
| `python-service/service.py` | **Spawned from Electron** in dev — `/health`, `/scan-file` (EICAR + ClamAV/stub), `/ai-task` (Groq + `local_fallback`), `/usb-list` |
| `package.json` | **Electron + Vite + builder tooling present** — uses **`npm`** / `package-lock.json` (not pnpm) |
| Demo auth | **Shipped** — `demoUsers.ts` + `LoginPage` → `session.set`; **audit `login` row** on success |
| Tray icon | **`HAS_ICON` guard** — optional PNG under `src/imports/` |

### Day 4 implementation update (2026-05-06, late)

- Runtime policy lock applied: `MEDIUM` and `HIGH` actions now route through HITL queue in `electron/main.ts`.
- HITL integrity guard added: approver cannot approve their own request (`requesterId !== approverUserId`).
- Execution outcomes standardized to `executed`, `hard_failed`, or `simulated`; audit payloads now include outcome status/evidence.
- Governance consent shipped: first-run consent modal with `consent_given` audit event.
- Governance copy now visible in admin/student footers and audit panel minimization messaging.
- Packaging contract updated in `package.json`: sidecar `service.exe` included under `extraResources`, invalid icon path removed, `electron` moved to `devDependencies`.

**Green tags:** `day-1-green`, `day-2-green`, `day-3-green` on the timeline that passed exit criteria. **Current:** Day 4 in progress (canonical USB flow, blocked-site enforcement, governance UI, truthful execution engine, policy IPC, medium=HITL). **Day 5 focus:** **plug-and-play portable `.exe`** with bundled sidecar and startup readiness checks.

### Locked sprint priorities (2026-05-05)

1. **Defense demo polish, future-ready for production** (ship fast).
2. Non-negotiable flows: USB scan, productivity assistant, blocked-site enforcement.
3. No fake success on sensitive actions; hard-fail clearly when unimplemented.
4. MEDIUM and HIGH actions follow HITL for this sprint.
5. Separate proposer/approver devices in demo (student vs admin laptops).
6. Student right panel remains compact; collapses to drawer on small windows.
7. Severity-coded user warnings/toasts are mandatory.
8. Continue with hybrid persistence: local fallback + Supabase shared state for two-runtime demos.

### Packaging pipeline lock (2026-05-06)

1. Day 5 deliverable is **packaging-first**: portable `.exe` must be the main launch path.
2. Bundle Python sidecar as `python-service/service.exe` for packaged mode (no system Python requirement on demo laptops).
3. Bundle sidecar dependencies into the sidecar artifact; avoid `pip install` steps on demo machines.
4. Keep internet-only cloud dependencies explicit: Groq + Supabase must pass startup checks.
5. Add startup readiness gate in-app (sidecar, Groq, Supabase) before demo run starts.
6. Retain truthful degraded-mode messaging for unavailable optional capabilities (e.g., ClamAV/USB driver constraints).

---

## Success criteria checklist (review at the end of Day 5)

**Progress mid-sprint (after Day 3 sign-off):** several infrastructure and spine items below are **already satisfied** in dev; items that require Day 4+ are left unchecked. Final sign-off still happens **after three rehearsals** per `daily-checklist.md`.

**Agentic spine (thesis-critical):**
- [x] Productivity Assistant chat panel exists in both student and admin contexts; tool whitelist visible.
- [x] Every assistant response shows a Risk Badge.
- [x] At least one HIGH-risk action appears in the Approvals Queue when triggered.
- [x] The queue blocks: until admin clicks Approve, the action does not execute. *(Executor still **stub** until Day 4 — stakeholder requires **real** effects next.)*
- [x] The Approvals Queue persists across app restart.
- [x] Audit rows for `action_proposed`, `action_approved`, `action_executed` link via the same `approvalId`.
- [ ] Action Timeline renders the canonical USB scenario with three labeled stages. **— Day 4**
- [ ] Governance footer visible on every panel. **— Day 4**
- [ ] Consent banner appears on first launch and is recorded in the audit log on accept. **— Day 4**

**Infrastructure:**
- [x] `npm run dev` opens an Electron window with the RUNA login.
- [x] Login → role routing works for both demo accounts.
- [x] Persistent Session checkbox survives restart.
- [x] **Run File Scan** opens the file picker, ClamAV (or stub) responds, audit row written.
- [x] Custom titlebar drag + minimize/maximize/close all work.
- [ ] System tray icon present with at least Show/Quit/Logout menu items. *(Menu: yes; **icon** may be absent until PNG added — `HAS_ICON`.)*
- [ ] Demo runs in **≤ 10 minutes** without an unrecovered crash. **— validate in rehearsal (Day 5)**

If 7+/9 agentic-spine items pass AND 6/7 infrastructure items pass on the day before demo, freeze scope and rehearse. Otherwise descope per `decision-tree.md`.
