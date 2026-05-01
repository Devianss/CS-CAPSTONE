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
- Real `/scan-file` (ClamAV or stub), real `/ai-task` (Bedrock or canned), real or simulated `/usb-list`.
- Audit-log persistence (electron-store JSON default; SQLite if `better-sqlite3` builds).
- Hard-coded "demo accounts" for student + admin login (no Cognito).
- Local dev launch (`npm run dev`) works reliably end-to-end.

## Out of scope (explicitly cut for the 5-day window)

- AWS Cognito auth (sessions are local).
- Real Bedrock evaluation rigor (a single canned response per tool is acceptable as long as it's labeled).
- ClamAV install on the demo machine (stub scan with EICAR signature recognition acceptable).
- Production Windows installer via `electron-builder` (nice-to-have on Day 5; portable zip is acceptable fallback).
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

**Agentic spine (thesis-critical):**
- [ ] Productivity Assistant chat panel exists in both student and admin contexts; tool whitelist visible.
- [ ] Every assistant response shows a Risk Badge.
- [ ] At least one HIGH-risk action appears in the Approvals Queue when triggered.
- [ ] The queue blocks: until admin clicks Approve, the action does not execute.
- [ ] The Approvals Queue persists across app restart.
- [ ] Audit rows for `action_proposed`, `action_approved`, `action_executed` link via the same `approvalId`.
- [ ] Action Timeline renders the canonical USB scenario with three labeled stages.
- [ ] Governance footer visible on every panel.
- [ ] Consent banner appears on first launch and is recorded in the audit log on accept.

**Infrastructure:**
- [ ] `npm run dev` opens an Electron window with the RUNA login.
- [ ] Login → role routing works for both demo accounts.
- [ ] Persistent Session checkbox survives restart.
- [ ] **Run File Scan** opens the file picker, ClamAV (or stub) responds, audit row written.
- [ ] Custom titlebar drag + minimize/maximize/close all work.
- [ ] System tray icon present with at least Show/Quit/Logout menu items.
- [ ] Demo runs in **≤ 10 minutes** without an unrecovered crash.

If 7+/9 agentic-spine items pass AND 6/7 infrastructure items pass on the day before demo, freeze scope and rehearse. Otherwise descope per `decision-tree.md`.
