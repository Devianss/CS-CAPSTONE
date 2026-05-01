# Roadmap — 5-Day Demo Sprint (Thesis-Aware)

This is the **strategic** view. For the canonical agentic design see `agentic-architecture.md`; for per-task granular instructions see `steps.md`; for tickable to-dos see `daily-checklist.md`.

> **Reordered after reading the thesis rationale.** Earlier versions of this file front-loaded UI plumbing and pushed AI/agentic work to Day 4 stretch. The thesis is scored on **bounded agentic behavior with HITL governance**, so the agentic spine (Productivity Assistant + Risk classification + Approvals Queue + Action Timeline) is now the **anchor work of Days 2 and 3**, alongside the Auth/Session/Sidecar plumbing.

---

## At-a-glance

```
Day 1  ─── Foundation ─────────────────  Electron actually boots                   [DONE — day-1-green]
Day 2  ─── Agentic Spine + Auth ───────  Assistant UI, Risk badges, Approvals Queue
                                         (mock backend) + real session round-trip
Day 3  ─── Real Wiring ────────────────  Python sidecar live: ClamAV, USB, /ai-task,
                                         audit-log persistence
Day 4  ─── Demo Flow + Governance ─────  Canonical USB-quarantine end-to-end +
                                         Action Timeline + RA 10173 affordances
Day 5  ─── Build + Rehearse ───────────  Portable, dry runs, recovery
```

Each day has a single **non-negotiable exit criterion**. If a day's exit criterion is not met, **do not start the next day's work** — fall back to the corresponding branch in `decision-tree.md` and either (a) cut scope or (b) carry the gap into a documented limitation.

---

## Day 1 — Foundation **[DONE]**

**Theme:** "Make the existing React UI run inside an Electron window."

### Exit criterion (passed)
**A frameless Electron window opens with the RUNA login screen, and you can drag, minimize, maximize, and close it from the custom titlebar.**

### Carry-over notes from Day 1 execution
- `npm` used in place of `pnpm` (existing `package-lock.json`).
- `electron-store` pinned to `^8` (v10 is ESM-only, incompatible with our CommonJS main process).
- `electron/db.ts` excluded from compilation (deferred to Day 3 — Path B / `electron-store` JSON is the default unless `better-sqlite3` builds cleanly).
- `startPythonService()` commented out (re-enabled Day 3).
- Tray icon hardened with `HAS_ICON` guard for missing asset.
- Day 1 changes not yet committed — commit + tag `day-1-green` before starting Day 2.

---

## Day 2 — Agentic Spine + Auth/Session

**Theme:** "Put the bounded agentic shape on screen, even with mock backends, and ship real session auth."

This day delivers what the thesis defense will actually score against (SP2/SP3): the Productivity Assistant, risk classification, and the Approvals Queue. Backends can be mocked — the structure must exist and persist.

### Deliverables (Tier 0 — Agentic Spine)
- `src/app/agentic/types.ts` — `AgentAction`, `RiskTier`, `ApprovalRequest`, `ToolDefinition`, `AgentContext`.
- `src/app/agentic/riskClassifier.ts` — deterministic rule table per `agentic-architecture.md` §3.
- `src/app/agentic/toolRegistry.ts` — student + admin tool whitelists per §4.
- `src/app/agentic/approvalQueue.ts` — in-memory queue with `electron-store` persistence under key `approvals_queue`.
- `<RiskBadge />` component — LOW/MED/HIGH chip used everywhere agent actions surface.
- `<ProductivityAssistant />` chat panel — single component, `role` prop switches mode. **Stub backend** (canned responses keyed by message content). Mounted on both student dashboard and a new admin sidebar item "ASSISTANT".
- `<ApprovalsQueue />` admin panel — new sidebar item between AUDIT and SETTINGS. Reads from queue, dispatches Approve/Reject/Request-info. Persists across reload.
- IPC surface: `agent:request`, `agent:list-pending`, `agent:approve`, `agent:reject`, `agent:list-tools`.

### Deliverables (Tier 1 — Auth/Session, original Day 2)
- `src/app/auth/demoUsers.ts` with the two demo accounts.
- `LoginPage.handleSignIn` calls `electronAPI.session.set(...)` with the authenticated user.
- `SessionGuard` in `Root.tsx` — redirects unauthenticated visits to `/`, bounces logged-in users away from `/` to their dashboard.
- Logout from admin/student dropdowns + tray menu clears session.
- "Persistent Session" checkbox controls survival across restart.

### Exit criterion
**(1)** A student logs in, opens the Productivity Assistant, sends a message, gets a response with a LOW RiskBadge. **(2)** A test "trigger HIGH action" button (stage-only) creates an entry in the Approvals Queue. **(3)** Admin logs in, sees the queue badge, approves it, the entry moves to history, and the demo state mutates to confirm execution. **(4)** Closing and reopening the app preserves the session AND the pending queue entries.

### Risks addressed
- Backend dependencies (Python + Bedrock) are not on the critical path for Day 2 — UI is wired to mocks.
- Approvals queue persistence: covered by electron-store, no native compile.
- Tool registry is hard-coded — no LLM tool-discovery complexity.

---

## Day 3 — Real Wiring (Python sidecar live)

**Theme:** "Replace the mocks with real backends. Make at least three things real."

### Deliverables
- Re-enable `startPythonService()` in `electron/main.ts`.
- Health badge in admin TopBar polling `/health` every 10s.
- **Real action #1 — ClamAV `/scan-file`:** triggered from a "RUN FILE SCAN" tile in `AccessControlPanel`. Toast + audit row + tray notification.
- **Real action #2 — `/ai-task` for the Productivity Assistant:** replace canned responses with calls to the Python sidecar's `/ai-task` endpoint, which calls Bedrock if creds present and returns a static fallback if not. Confidence score parsed from the response (or defaulted to 0.85 if missing).
- **Real action #3 — `/usb-list` (and stub `/usb-quarantine`):** Python service exposes pyusb enumeration. UI shows currently connected USB devices in a small panel on the admin Lab Monitoring view.
- **Audit-log persistence wired** (per `decision-tree.md` §2):
  - **Path A (preferred):** `better-sqlite3` builds → call `db.logEvent(...)` from main; expose `audit:list` IPC.
  - **Path B (default until A is proven):** Persist a JSON array via `electron-store` under key `audit_log`; same IPC surface.
- **Audit row schema extended** with HITL fields (`approvalId`, `approverUserId`, `riskTier`, `confidenceScore`) per `agentic-architecture.md` §6. Additive — does not break existing rows.
- Every `action_proposed`, `action_approved`, `action_rejected`, `action_executed`, `chat_request`, `chat_response`, `request_refused`, `tool_invoked` writes an audit row.

### Exit criterion
**(1)** Picking a file from the OS file picker shows a real ClamAV (or stub) result toast and writes an audit row that survives restart. **(2)** Sending a chat message to the assistant calls the Python `/ai-task` endpoint and the response is rendered in the chat. **(3)** USB devices currently plugged into the demo machine appear in the USB panel. **(4)** Audit Trails shows the new HITL columns populated for any approved action from Day 2's stage button.

### Risks addressed
- `better-sqlite3` native compilation — fallback to electron-store JSON is the default.
- Bedrock creds missing — Python service returns a labeled static response; demo still flows.
- ClamAV not installed — Python service falls through to SHA-256 + "clean" stub, clearly labeled.
- pyusb permissions on Windows — fallback to a stage button that simulates the USB event.

---

## Day 4 — Canonical Demo Flow + Governance

**Theme:** "Wire the canonical USB-quarantine storyline end-to-end and add the RA 10173 governance affordances."

### Deliverables (anchor scenario)
- `<ActionTimeline />` component — renders Perception → Reasoning → Action stages with timestamps. Receives a stream of agent events via a context.
- `src/app/agentic/scenarios/usbInsertion.ts` — orchestrator that wires:
  1. USB inserted (real pyusb event OR stage button) → `usb_inserted` audit row + perception event.
  2. ClamAV scan → reasoning event with progress.
  3. Risk classified HIGH → action proposed → enters Approvals Queue.
  4. Student sees non-blocking banner; their assistant remains usable.
  5. Admin approves → `quarantine_usb` executes (or simulated) → both audit rows written with linked `approvalId`.
  6. Tray notification fires.

### Deliverables (governance — `agentic-architecture.md` §8)
- **Consent banner** on first launch (modal) — accepts → writes `consent_given` audit row, persisted dismissed via `electron-store`.
- **Governance footer** on every panel — retention period, role, PII redaction indicator, encryption indicator.
- **Audit Trails: Data Minimization tooltip** near Export.
- **Productivity Assistant scope statement** — small banner above the chat input listing available tools.
- **Settings → Privacy** sub-panel — data categories, retention, user rights, link to policy.

### Deliverables (carry-over from previous Tier 1.5)
- COMLAB modular config + scheduling data model (`sprint/scheduling-architecture.md`).
- Layout fixes (min-h-screen → h-full, z-index, kebab handlers).
- NotificationProvider lifted to `App.tsx`.
- AccessCode validation wired to `validateAccessCode` resolver.

### Deliverables (admin override actions — wired with HITL)
- **Lock Cluster** confirm modal: classifies action HIGH → goes through Approvals Queue (admin self-approving demonstrates the two-party pattern). On approval, `policy.set('comlab_08_locked', '1')` + audit row.
- **Terminate All Sessions**: same pattern.
- **WIPE TERMINAL** alert button: same pattern.
- **Kiosk Mode toggle** in Settings: classified MEDIUM (reversible, single-machine) → auto-executes with audit row.

### Exit criterion
**The canonical USB scenario from `agentic-architecture.md` §7 runs end-to-end without the presenter touching code: USB triggers (real or staged) → assistant remains usable → admin queue shows the request → admin approves → action executes → tray notifies → audit shows the linked rows.** Plus 7+/9 of the Definition-of-Done items in `agentic-architecture.md` §13.

### Risks addressed
- USB hardware unreliable on demo machine — stage button simulates the perception event.
- Bedrock latency unpredictable — assistant has a 5s timeout with a labeled fallback message.
- Admin self-approval feeling weird — narrate it: "The two-party pattern protects against accidental clicks; in production the proposer and approver are different people."

---

## Day 5 — Build + Rehearse

**Theme:** "Make it portable, then rehearse until it's boring."

### Deliverables (build track)
- `electron-builder` config in `package.json` for a `--win portable` target.
- `npm run build:win` produces `release/RUNA Lab Portal x.x.x.exe` (portable single-file `.exe`).
- Smoke-test on the demo machine.
- (Optional, time-permitting) Migrate audit log from electron-store JSON to SQLite (Path A); add chained row-hash integrity column.

### Deliverables (rehearsal track)
- **3 full dry runs** of `demo-script.md`, timed.
- A **fallback launcher script** (`run-demo.bat`) that runs `npm run dev` as Plan B.
- **Backup recording** of a successful run.
- Cue card with the canonical storyline beat sheet.

### Exit criterion
**Demo script runs in 8–10 minutes, three consecutive times, with no presenter code edits, no manual recovery actions, and the canonical USB scenario completing every time.**

### Risks addressed
- Native module rebuild for production (`electron-builder` runs `electron-rebuild`); if it fails, ship the dev launcher.
- Antivirus quarantining the unsigned `.exe` — instruct the demo operator to right-click → Run anyway, or fall back to dev launcher.
- Bundling the Python service with PyInstaller is **out of scope**; we ship `python service.py` as a side script and have the dev launcher start it.

---

## Sequencing rules

1. **Never start a day's work until the previous day's exit criterion passes.** If you're stuck, jump to `decision-tree.md`.
2. **Cut scope, never deadlines.** If Day 2's agentic spine is bleeding into Day 3, drop the admin-mode tools (keep student-only) and document. If Day 3's real wiring is bleeding into Day 4, keep ClamAV + chat real, stub USB.
3. **Commit at every green checkpoint.** Tag `day-1-green`, `day-2-green`, … so we can revert if Day 4 polish breaks Day 3 functionality.
4. **Tier 0 (agentic spine) work blocks every other day.** If Day 2 doesn't ship the queue + assistant + risk badges, Day 4's canonical flow has nothing to wire to. Day 2 cannot be cut to a half-day.
5. **Keep one developer on rehearsal track from Day 4 afternoon onward**, even if Day 4 features are still in flight. The demo flow itself must be rehearsed.

---

## Stretch goals (only attempt if Day 4 finishes early)

- Chained row-hash audit integrity (sha256 of (prevHash + row JSON)), shown live in Audit Trails.
- Admin Productivity Assistant calling `propose_action` to create a real Approvals Queue entry from chat (closes the loop between LLM reasoning and HITL governance — strong defense moment).
- Confidence-band visualization on AI responses (color-coded confidence pill).
- Multi-user "different admin approves than the one who proposed" demo flow.

Anything not in the stretch list above is **post-thesis-demo work** and should not be touched during the sprint.

---

## What changed from the previous version of this roadmap

For traceability:

- **Day 2 was "Auth + Session" only.** Now also delivers the agentic spine UI shells (Productivity Assistant, Risk badges, Approvals Queue) with mock backends.
- **Day 3 was just `/scan-file` + audit log.** Now also wires `/ai-task` for the assistant and `/usb-list` for the canonical scenario.
- **Day 4 was "Integration + Polish" generally.** Now anchored on the canonical USB-quarantine storyline plus RA 10173 governance affordances. Old Tier 1 work (layout, comlab modularity, scheduling) folded in.
- **Day 5 unchanged** in shape; SQLite migration promoted to "if time permits" rather than blocking.
- **Stretch list now agentic-flavored** (chained hashes, propose_action, confidence bands) rather than generic polish.

The thesis is being evaluated on bounded agentic behavior with HITL governance. The roadmap now reflects that.
