# Bounded Agentic Architecture — Runa

> The canonical thesis-aware design document. Every sprint task downstream of Day 1 references this file. If you change anything in here, update `roadmap.md` and `demo-script.md` to match.

---

## 1. Why this document exists

The thesis is titled **"The Development of Runa: Agentic Robotic Process Automation for Malware Detection and Security with Intelligent Process Automation for PCU-Dasmariñas Computer Laboratories."** The defense panel will not score us on UI polish — they will score us against the five Specific Problems / Specific Objectives in the rationale:

| Specific Problem / Objective | Demo must show |
|---|---|
| **SP1/SO1**: Functional + non-functional requirements | Module shells exist for all five core areas (attendance, web governance, malware, admin monitoring, **productivity assistant**) |
| **SP2/SO2**: Architecture for bounded agentic behavior | Visible **Perception → Reasoning → Action** cycle on at least one flow, with **task-state**, **tool-coordination**, and **escalation** all on screen |
| **SP3/SO3**: Distinguish low-risk autonomous vs. high-risk human-review | Every agent action carries a **LOW / MEDIUM / HIGH** badge. HIGH actions are **blocked** in an admin Approvals Queue and cannot proceed without explicit Approve |
| **SO4**: Governance safeguards | Permissions per role, action boundaries (tool whitelists), audit log of every agent action, confidence-based escalation, human review gates |
| **SO5**: Usability evaluation (SUS) | UI is clear, predictable, evaluator-friendly |

This document defines the architecture that answers SP2, SP3, and SO4 — the three columns where the existing build has **zero coverage** today.

---

## 2. The bounded agentic core — P-R-A cycle

Per the literature review (Wang & Chen 2025; Waber et al. 2026), a bounded agentic system operates on a **Perception → Reasoning → Action** loop within explicit governance boundaries.

```
┌─────────────────────────────────────────────────────────────────┐
│                      RUNA AGENTIC CORE                          │
│                                                                 │
│   ┌────────────┐    ┌────────────┐    ┌────────────────────┐    │
│   │ PERCEPTION │ →  │ REASONING  │ →  │ ACTION             │    │
│   │            │    │            │    │                    │    │
│   │ - USB ins. │    │ - Scan w/  │    │ if risk = LOW      │    │
│   │ - File DL  │    │   ClamAV   │    │   → execute        │    │
│   │ - URL req. │    │ - Classify │    │ if risk = MEDIUM   │    │
│   │ - Chat req.│    │   risk     │    │   → execute + log  │    │
│   │ - Login    │    │ - Pick tool│    │ if risk = HIGH     │    │
│   │            │    │   (whitel.)│    │   → ESCALATE to    │    │
│   │            │    │ - Confidence│   │     admin queue    │    │
│   │            │    │   score    │    │     (block + wait) │    │
│   └────────────┘    └────────────┘    └────────────────────┘    │
│         │                  │                    │               │
│         └──────────────────┴────────────────────┘               │
│                            ↓                                    │
│                ┌─────────────────────────┐                      │
│                │ AUDIT LOG (immutable)   │                      │
│                │ - perception event      │                      │
│                │ - reasoning trace       │                      │
│                │ - tool selected         │                      │
│                │ - risk tier             │                      │
│                │ - action taken          │                      │
│                │ - HITL decision (if any)│                      │
│                └─────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation note for the demo:** we need at least **one flow** that visibly traverses all three stages on screen. The canonical demo flow (§7) is the USB-insertion scenario, which exercises Perception (USB plug-in event), Reasoning (ClamAV scan + risk classification), and Action (HIGH → escalate to Approvals Queue).

---

## 3. Risk tier classification

Every agentic action is classified into one of three tiers at decision time. **The classification is what determines whether HITL is triggered.** This is the literal answer to SP3.

### Definitions

| Tier | Criteria | HITL gate? | Examples |
|---|---|---|---|
| **LOW** | Read-only, reversible, in-scope per role. No system state mutation outside the chat session. | None — auto-execute, log it | Productivity assistant answers a question. Audit log query. Health check. View policy. |
| **MEDIUM** | Mutates non-critical state OR provides a recommendation that the user will act on. Reversible. | **Sprint lock (2026-05-05): route through HITL**. Baseline architecture allows auto-execute in mature deployments. | Recommend a response to an alert. Suggest a website blocklist entry. Generate a draft policy. Mark a notification as read. |
| **HIGH** | Mutates critical state, irreversible, or affects multiple users. | **BLOCK** — route to admin Approvals Queue. Action cannot proceed without explicit Approve. | Wipe terminal. Lock cluster. Terminate sessions. Quarantine USB. Add URL to enforced blocklist. Force-logout student. |

### Classifier inputs

The risk classifier (`src/app/agentic/riskClassifier.ts`) takes:
- `action.type` — declared at the call site (e.g., `'wipe_terminal'`, `'chat_response'`)
- `action.scope` — `'self'` (only affects requester), `'session'` (one user's session), `'lab'` (all PCs in lab), `'system'` (cross-lab)
- `action.reversible` — boolean
- `action.confidence` — 0..1 (only for AI-recommended actions)

### Static rule table (deterministic, defensible)

```ts
// Hard-coded rules — no ML. Defense-friendly: no opaque scoring.
const RISK_RULES: Record<ActionType, RiskTier> = {
  // LOW
  'chat_response':       'low',
  'audit_query':         'low',
  'view_policy':         'low',
  'health_check':        'low',

  // MEDIUM
  'recommend_action':    'medium',
  'draft_policy':        'medium',
  'mark_notification':   'medium',

  // HIGH (anything that mutates lab/system state)
  'wipe_terminal':       'high',
  'lock_cluster':        'high',
  'terminate_session':   'high',
  'quarantine_usb':      'high',
  'force_logout':        'high',
  'enforce_blocklist':   'high',
};
```

### Confidence-based escalation

For LLM-driven actions, if `confidence < 0.7` we **escalate one tier** (LOW → MEDIUM, MEDIUM → HIGH). Talking point: this is the "confidence-based escalation" named in the rationale's Definition of Terms.

---

## 4. Tool whitelists per role

The Productivity Assistant works in two modes — **student** and **admin** — sharing one chat component but with different system prompts and tool whitelists. This is the "approved tool use" boundary named in SO2.

### Student mode

**System prompt (excerpt):**
> "You are a bounded academic assistant for a computer-science student in a university laboratory. You may only respond to messages sent in this chat. You may not read files, access the network, or modify any system state. If asked to do anything beyond academic explanation, refuse and suggest the student contact lab staff."

**Tool whitelist:**
| Tool | Risk | Description |
|---|---|---|
| `summarize_text` | LOW | Summarize pasted text |
| `explain_concept` | LOW | Explain a CS / academic concept |
| `code_review` | LOW | Comment on pasted code |
| `generate_outline` | LOW | Outline an essay / paper |
| `explain_error` | LOW | Explain a pasted error message |

**No higher-risk tools available.** Out-of-scope requests are refused with a templated message and logged as `request_refused`.

### Admin mode

**System prompt (excerpt):**
> "You are a bounded operational assistant for a laboratory administrator. You may summarize, recommend, and draft, but you may not directly execute any state-mutating action. HIGH-risk actions must be approved in the Approvals Queue. For this sprint's defense run, proposer and approver are separate users/devices."

**Tool whitelist:**
| Tool | Risk | Description |
|---|---|---|
| `summarize_audit` | LOW | Summarize today's audit log |
| `explain_alert` | LOW | Explain a specific security alert |
| `recommend_response` | MEDIUM | Recommend a response to an alert (admin still acts) |
| `draft_policy` | MEDIUM | Draft a website blocklist update |
| `propose_action` | HIGH | Queue a state-mutating action for HITL approval |

**Important defense point:** even when the admin is the requester, HIGH actions still go through the Approvals Queue. This protects against the admin's own accidental acknowledgments and creates a tamper-evident two-step audit trail.

---

## 5. HITL gates and the Approvals Queue

User decision (locked): **HIGH-risk actions BLOCK until admin approves.** This is true Human-in-the-Loop, not Human-on-the-Loop.

### Behavior

1. Agent classifies action as HIGH.
2. Action is wrapped in an `ApprovalRequest` and pushed to the in-memory + persisted queue.
3. The requesting flow **awaits** the queue's resolution. UI shows "Pending admin approval" state with a queue position indicator.
4. Admin opens the Approvals Queue panel (new admin sidebar item between AUDIT and SETTINGS).
5. Admin sees: requester, requested action, full reasoning trace, risk tier, supporting evidence (e.g., ClamAV scan output), confidence (if AI-driven), `Approve` / `Reject` / `Request more info` buttons.
6. On Approve: action executes, audit row written with both requester and approver IDs.
7. On Reject: action is voided, audit row written with rejection + admin's optional comment.
8. On Request-info: status returns to queue with a comment thread; requester sees a notification.

### Approval persistence and timeout

- Pending approvals persist via `electron-store` under `approvals_queue` so they survive app restart.
- Default timeout: **none** for the demo — pending requests stay pending indefinitely. Production design includes a 24h timeout that auto-rejects + escalates to a higher role; out of scope for the prototype.
- If the requester logs out before approval, the request stays in the queue. On approval after the requester is gone, action executes and an `awaiting_user_notification` flag is set; user sees the result on their next login.

### Approval data model

```ts
interface ApprovalRequest {
  id: string;                       // uuid
  createdAt: number;                // epoch ms
  requesterId: string;              // user email
  requesterRole: 'student' | 'admin';
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
  riskTier: 'high';                 // only HIGH ever lives here
  reasoning: string;                // human-readable trace
  evidence?: {                      // optional supporting data
    scanResult?: ScanResult;
    aiConfidence?: number;
    sourceAlert?: AlertId;
  };
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  decision?: {
    decidedAt: number;
    decidedByUserId: string;
    comment?: string;
  };
  comments?: Array<{ at: number; byUserId: string; text: string }>;
}
```

---

## 6. Audit log — HITL extensions

The existing audit-log plan in `decision-tree.md` is correct as scaffolding but needs HITL-aware fields to satisfy SO4 (governance audit) and the RA 10173 obligations from the literature review.

### Schema (additive — extends the Day 3 audit row)

```ts
interface AuditRow {
  id: number;
  createdAt: number;
  eventType: string;                // 'login', 'file_scan', 'action_proposed', 'action_approved', 'action_rejected', 'action_executed', 'request_refused', 'consent_given', ...
  actorUserId: string;              // who triggered the event
  actorRole: 'student' | 'admin' | 'system' | 'agent';

  // HITL fields (null for non-HITL events)
  approvalId?: string;              // links to ApprovalRequest.id
  approverUserId?: string;          // populated only on action_approved/rejected
  riskTier?: 'low' | 'medium' | 'high';
  confidenceScore?: number;         // 0..1 for AI-driven actions

  // Payload
  detail: string;                   // JSON-stringified context

  // Integrity (Phase 2 — designed-in, stub for now)
  prevHash?: string;                // chain checksum
  rowHash?: string;                 // sha256(row sans rowHash)
}
```

### Event taxonomy

The events the audit log MUST capture:

| Event type | When | Risk-tier captured |
|---|---|---|
| `login` / `logout` | Session boundary | n/a |
| `consent_given` | First-launch acceptance of data-collection notice | n/a |
| `chat_request` | User sends a message to the assistant | low |
| `chat_response` | Assistant returns a response | low |
| `request_refused` | Assistant refuses an out-of-scope request | low |
| `tool_invoked` | Assistant calls a whitelisted tool | varies |
| `action_proposed` | Agent (or assistant) proposes a HIGH action → queued | high |
| `action_approved` / `action_rejected` | Admin decision in queue | high |
| `action_executed` | Action runs after approval | high |
| `file_scan` | ClamAV scan completes | varies |
| `usb_inserted` / `usb_removed` | pyusb event | n/a |
| `policy_changed` | Lock/unlock cluster, blocklist update, kiosk toggle | high |

### RA 10173 mapping

| RA 10173 control | Runa implementation |
|---|---|
| **Lawful processing / consent** | First-launch consent banner; `consent_given` audit row |
| **Data minimization** | We log session events and security events, not screen content or keystrokes. The audit row schema explicitly omits user-typed content beyond the chat |
| **Purpose specification** | Privacy notice declares: "session monitoring, security enforcement, audit accountability" |
| **Access control (RBAC)** | Role-based session payload; audit list filtered by role |
| **Storage limitation** | Default 90-day retention indicator on Audit Trails panel |
| **Accountability** | Every state mutation is auditable; HITL approvals create non-repudiable two-party records |
| **Security of processing** | Local SQLite + chained row hashes (Phase 2 stub now, real on Day 5 or post-defense) |

These are surfaced as small UI affordances in the demo (a Governance footer + a one-time consent banner) so the panel can see them without us narrating each.

---

## 7. Canonical demo storyline

User decision (locked): the USB → ClamAV → escalation → admin approval → action flow is the anchor scenario. **Every other demo segment supports or contextualizes this 90-second story.**

### Beat sheet

```
T=0:00   STUDENT mode. Student is logged in at the kiosk. Productivity
         Assistant is open. They've been chatting about a CS lab assignment.

T=0:05   PERCEPTION. A USB is inserted (we trigger via a stage button or
         simulate via the Python service). pyusb event flows to renderer
         via IPC: "Removable media detected: SanDisk 16GB."

T=0:15   REASONING (visible). A small "Agent active" pill appears on the
         student dashboard. Action Timeline component opens at the bottom:
           ▸ Perception: USB inserted (timestamp)
           ▸ Reasoning:  Scanning with ClamAV...
         A spinner ticks for ~2s while the Python service runs the scan.

T=0:25   ClamAV returns: "Threat: Eicar-Test-Signature." Risk classifier
         runs: actionType='quarantine_usb', scope='session', reversible=false
         → tier=HIGH.

T=0:30   ACTION (escalation). The Action Timeline updates:
           ▸ Action: Risk HIGH → escalating to admin Approvals Queue
         Student sees a non-blocking banner: "Your USB is held for safety
         review. An administrator has been notified." Their assistant
         remains usable for academic chat (LOW-risk tools still work).

T=0:40   STAGE TRANSITION. Presenter logs out as student, logs in as admin.
         (In production, a different physical machine; for demo, single
         laptop with role switch.)

T=0:55   ADMIN view. Sidebar shows red badge on APPROVALS QUEUE (new item).
         Click it. Queue panel shows one pending request:
           - Requester: student@runa.edu.ph
           - Action:    quarantine_usb
           - Risk:      HIGH
           - Evidence:  ClamAV detected Eicar-Test-Signature on
                        SanDisk 16GB inserted at 21:34:05
           - Reasoning: Auto-classified HIGH because reversible=false
                        and threat detected (rule R12).
         Three buttons: [Approve] [Reject] [Request more info]

T=1:10   Admin clicks [Approve]. Toast: "Action approved and executed."
         Three things happen:
           1. quarantine_usb executes (in real Runa, calls Python to
              unmount + log the device serial).
           2. Audit row written: action_approved + action_executed,
              both linked to the same approvalId.
           3. Tray notification: "USB quarantined per admin approval."

T=1:25   Click AUDIT. The new rows appear at the top, with the HITL
         columns populated: requester, approver, riskTier, approvalId.
         Show that the action_proposed and action_approved rows both
         reference the same approvalId.

T=1:30   Storyline complete. Optional follow-on segments cover dashboard
         tour, web governance, settings, etc.
```

### What this storyline proves to the panel

| Thesis claim | Beat that proves it |
|---|---|
| "Bounded agentic system" | The agent operates within declared tool whitelist (USB scan tool only; no arbitrary OS calls) |
| "Perception-Reasoning-Action cycle" | Action Timeline literally renders these three stages |
| "Confidence-based escalation" | Risk tier visibly drives the HIGH → queue routing |
| "Human-in-the-Loop for high-risk actions" | Quarantine BLOCKS until admin clicks Approve |
| "Multi-step coordination" | USB event → scan → classify → escalate → notify is a coordinated chain across modules |
| "Task-state retention" | Pending approval persists; survives logout and app restart |
| "Audit accountability" | Linked audit rows with both requester and approver IDs |
| "Bounded autonomy, not full autonomy" | Action did NOT auto-execute; admin had final say |

---

## 8. Governance affordances (RA 10173 surface area)

Small UI elements with disproportionate defense value:

1. **First-launch consent banner.** A modal on the very first app launch (and persisted-dismissed via `electron-store`):
   > "RUNA logs your laboratory session, security events, and assistant interactions to support PCU's data privacy policy under RA 10173. Logs are retained for 90 days and accessible only to authorized administrators. By continuing, you acknowledge this policy."
   > [I understand and consent]   [View full policy]
   On accept, write a `consent_given` audit row tagged with the user.

2. **Governance footer on every panel.** A thin slate strip at the bottom:
   > Audit retention: 90 days · Role: ADMIN · PII redaction: ON · Logs encrypted at rest
   This footer lives in the same layout shell as the topbar, so it's literally always on screen.

3. **Audit Trails: "Data Minimization" indicator.** A small ⓘ tooltip near the Export button:
   > "Audit logs capture event metadata only — user-typed content (chat messages, file contents) is not stored beyond the active session."

4. **Productivity Assistant scope statement.** A small banner above the chat input:
   > "I do not access your files or network. I only respond to messages you send in this chat. (Student mode: 5 academic tools available.)"

5. **Settings → Privacy panel.** Lists the data categories collected, the retention period, the user's rights (view, export, request-erasure), and a link to the full policy document.

These five elements take maybe 4 hours total to build and make the local-governance gap claim defensible.

---

## 9. Defense Q&A — agentic talking points

Pre-baked answers for likely panelist questions, beyond the existing Q&A in `demo-script.md`.

| Q | A |
|---|---|
| "Where exactly is the agentic behavior?" | "The Productivity Assistant chat panel and the security agent that handled the USB insertion. Both run on a Perception-Reasoning-Action cycle visible in the Action Timeline. The agent doesn't just react to clicks — it perceives system events, reasons about them via tool selection and risk classification, and acts within bounded permissions." |
| "What stops it from doing something dangerous?" | "Three layers. First, the tool whitelist — the agent can only invoke tools we've explicitly registered per role. Second, the risk classifier — every action is classified LOW/MEDIUM/HIGH by deterministic rules. Third, the HITL gate — every HIGH action is blocked in the Approvals Queue until an admin clicks Approve. The agent cannot wipe a terminal even if instructed to." |
| "Is the risk classification AI-based? What happens if it's wrong?" | "The classifier is rule-based and deterministic, exactly to avoid that failure mode. The rule table is in source — no opaque scoring. For AI-driven recommendations, we add a confidence threshold: if model confidence is below 0.7, we escalate one tier. The fallback is always 'route to human.'" |
| "Why HITL instead of HOTL? Doesn't that defeat automation?" | "Per Waber et al. (2026), HOTL works in mature production systems where reversibility and rollback are well-understood. For a university laboratory prototype dealing with security state — wiping disks, locking clusters — irreversibility is the dominant concern. Our design accepts the latency cost of HITL for the safety guarantee. Phase 2 work could promote LOW-MEDIUM auto-execution and HOTL-style admin oversight, but HIGH stays HITL." |
| "How do you handle the 3 AM scenario where no admin is online?" | "Two answers. Architectural: the Approvals Queue persists, so the request waits. The student sees 'Your action is queued for review' and the dangerous artifact (USB, file) is held in quarantine. Operational: Phase 2 adds a tiered escalation policy — if no admin acts within N hours, the request is routed to a higher role or auto-rejected with notification. We don't auto-approve at any tier." |
| "Show me where the agent's decision is logged." | (Click AUDIT, point to the action_proposed → action_approved → action_executed rows linked by approvalId.) "Every reasoning step generates an audit row. The chain is reconstructable from the approvalId. In the production design, each row carries a chained hash for tamper-evidence." |
| "What's bounded about it? Can the assistant write code that calls anything?" | "No. The assistant has a fixed tool whitelist of five tools in student mode and five in admin mode. It does not have a general 'execute' tool. If a student asks it to delete a file, it refuses with a templated message and logs the refusal. We can show that with a request like 'delete C:\\\\Windows\\\\System32' in the chat — the response is the refusal template." |
| "How does this integrate with RA 10173?" | "Three places. First, a consent banner on first launch logs `consent_given`. Second, the data minimization principle is enforced at the audit-row schema level — we never log user-typed chat content beyond the active session. Third, the governance footer surfaces retention period and role. The literature review identified this — Philippine HEI work not engaging with RA 10173 — as one of the three research gaps Runa fills." |

---

## 10. Implementation phasing (mapped to sprint days)

What we actually build, when, and what's a stub vs. real.

### Tier 0 — Defense-Critical Agentic Spine (Days 2–4)

| Module | Day | Stub/Real | Notes |
|---|---|---|---|
| `src/app/agentic/types.ts` | 2 | Real | Type definitions, no logic |
| `src/app/agentic/riskClassifier.ts` | 2 | Real | Deterministic rule table |
| `src/app/agentic/toolRegistry.ts` | 2 | Real | Tool definitions per role |
| `src/app/agentic/approvalQueue.ts` | 2 | Real (in-memory + electron-store) | Persisted queue |
| `<RiskBadge />` component | 2 | Real | LOW/MED/HIGH chip |
| `<ProductivityAssistant />` chat | 2 | Stub backend | UI complete; backend canned responses |
| `<ApprovalsQueue />` admin panel | 2 | Real | Reads from queue, dispatches decisions |
| `<ActionTimeline />` component | 3 | Real | P-R-A renderer |
| Real `/ai-task` wiring | 3 | Real | Calls Groq if key present, else canned |
| Real ClamAV `/scan-file` wiring | 3 | Real (or stub fallback) | Already exists in Python service |
| Real `/usb-list` and `/usb-quarantine` | 3 | Real on demo machine, stub elsewhere | pyusb |
| `<GovernanceBanner />` + consent modal | 4 | Real | Five small UI affordances per §8 |
| HITL audit row extensions | 4 | Real | Extends existing schema additively |
| End-to-end USB demo flow | 4 | Real | Orchestrator wires the canonical storyline |

### Tier 1 — Architectural Credibility (Days 2–3, parallel to Tier 0)

The previously planned Tier 1.5 work, kept and folded into the agentic-spine days:

- COMLAB modular config + scheduling data model (`scheduling-architecture.md`)
- Layout fixes (min-h-screen → h-full, z-index, kebab handlers)
- NotificationProvider lift
- Auth + Session (the original Day 2 plan)

### Tier 2 — Polish & Hardening (Day 5)

- SQLite audit log migration (Path A from `decision-tree.md`)
- Chained row-hash integrity (stub → real if time)
- Tray icon + settings persistence + demo-bundle packaging

### What remains explicitly out of scope (descoped for defense)

- Cognito auth, DynamoDB sync, S3, QuickSight
- Code signing, auto-update, auto-launch
- Real LLM evaluation (we just need it to respond plausibly during the demo)
- Tiered escalation timeouts (designed in §5, not implemented)
- Multi-machine queue federation

---

## 11. Open design micro-decisions (defaults applied)

Recording these so we don't re-litigate during implementation:

1. **Risk classifier is rule-based, not ML-based.** Deterministic, defensible, easy to test.
2. **Tool whitelist is hard-coded per role.** No dynamic tool discovery for the prototype.
3. **Approvals Queue is in-process + persisted to electron-store.** No external queue (Redis/SQS) for the demo.
4. **Pending requests have no timeout in the prototype.** Documented as Phase 2 work.
5. **Both student and admin Productivity Assistants share one component**, parameterized by `role` prop, with different system prompts and tool lists from `toolRegistry.ts`.
6. **Demo USB scenario uses the EICAR test file** loaded onto a real USB stick. Fallback: stage button that simulates the USB event without physical hardware.
7. **Approver ID always logged separately from requester ID**, even when they're the same person, so the two-party audit pattern is demonstrable.
8. **Confidence-based escalation rule:** `confidence < 0.7` bumps the tier up by one. Threshold value defensible as "industry-standard low-confidence cutoff."

---

## 12. Cross-references

- Sprint-level plan: `sprint/roadmap.md` (see Days 2–4 reordering)
- Per-day tasks: `sprint/steps.md` §6 (Agentic Spine) and `sprint/daily-checklist.md`
- Demo walkthrough: `sprint/demo-script.md` (re-anchored on the canonical storyline above)
- Risk fallbacks: `sprint/decision-tree.md` (extend with new branches in Day 2's section)
- Comlab + scheduling: `sprint/scheduling-architecture.md` (still applies; Tier 1 work)
- Frontend audit basis: `sprint/frontend-audit.md` and `sprint/frontend-audit-decisions.md`

---

## 13. Definition of Done (for the agentic spine)

The Tier 0 work is complete when **all** of the following are true on the demo build:

- [ ] The Productivity Assistant chat panel exists in both student and admin contexts. Five tools each. System prompt visible in a "Scope" tooltip.
- [ ] Every assistant response shows a RiskBadge on the message bubble.
- [ ] At least one HIGH-risk action (the USB quarantine or any other) appears in the Approvals Queue when triggered.
- [ ] The queue blocks: until admin clicks Approve, the action does not execute.
- [ ] The Approvals Queue persists across app restart.
- [ ] Audit rows for `action_proposed`, `action_approved`, and `action_executed` all link via the same `approvalId`.
- [ ] The Action Timeline renders the canonical USB scenario with three labeled stages.
- [ ] The Governance footer is visible on every panel.
- [ ] The consent banner appears on first launch and is recorded in the audit log on accept.

If 7+/9 of the above pass by EOD Day 4, we ship. If fewer, we descope per `decision-tree.md`.
