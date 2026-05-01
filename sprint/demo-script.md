# Demo Script — 8-minute Walkthrough (Thesis-Aware)

The actual minute-by-minute script the presenter follows. **Anchored on the canonical USB-quarantine storyline** from `agentic-architecture.md` §7. Every other segment supports or contextualizes that anchor.

> Total target time: **8 minutes ± 1**. If it runs long, drop Segment 6 (admin assistant chat) first, then Segment 1 (dashboard tour). The anchor scenario (Segments 3–5) is non-negotiable.

---

## Pre-stage setup (T-30 min)

1. Reboot the demo laptop. Plug in charger.
2. Disable Windows Defender real-time scan + Windows Update for the duration.
3. Plug in a USB stick containing `eicar.com` (the standard harmless test signature). **Verify it shows up in `/usb-list` before the panel arrives.**
4. Launch `run-demo.bat` (or double-click the portable `.exe`).
5. Wait for both Vite + Python service consoles to print "ready."
6. Verify the RUNA login screen is showing in the Electron window.
7. Verify the green health dot in the top bar (log in once as admin, verify, log out, leave on the login screen).
8. **Pre-seed one resolved Approvals Queue entry from yesterday** so the admin queue history isn't empty. (Or accept an empty history — either is fine, just don't be surprised.)
9. Place backup video in second monitor / Alt-Tab spot.
10. Cue card on bezel:
    ```
    1. Open + login student → Productivity Assistant → 2-3 chats
    2. Insert USB → Action Timeline shows P → R → A
    3. Logout student → login admin → Approvals Queue
    4. Approve → audit shows linked rows
    5. (Optional) Admin assistant: summarize today's audit
    6. Logout
    ```

---

## Segment 0 — Opening (0:00 – 0:30)

**Stage:** Stand beside the laptop. RUNA login screen is showing.

**Say:**
> "This is **Runa**, the bounded agentic RPA prototype for PCU-Dasmariñas computer laboratories. The thesis title spells it out: agentic, but bounded — the AI operates within explicit permissions, approved tools, and human-review gates for any high-risk action. I'll walk you through one end-to-end scenario in about 8 minutes that exercises every claim in the rationale."

**On screen:** RUNA login page with Student/Admin tabs and the consent banner footer.

> If this is the first ever launch on the demo machine, the consent modal appears. Accept it on stage — it sets up the talking point. If it's a repeat launch, point at the governance footer instead.

**Pointing at the governance footer:**
> "Notice the footer — audit retention, current role, RA 10173 compliance posture. That's on every screen."

---

## Segment 1 — Student login + Productivity Assistant (0:30 – 2:00)

**Stage:** Click **STUDENT** tab. Type `student@runa.edu.ph` / `runa-student`. Submit.

**On screen:** Student Dashboard with the Productivity Assistant panel open by default.

**Say:**
> "Student view — locked-down kiosk. The Productivity Assistant on the right is one half of the agentic system. It's bounded: five tools, all read-only academic — summarize, explain concept, code review, outline, explain error. No file access, no network, no system mutation."

**Stage:** Type into the chat: "Explain Big-O notation in 3 sentences."

**On screen:** Assistant response renders with a green LOW RiskBadge on the message bubble.

**Say (pointing at the badge):**
> "Every agent action carries a risk classification. This response is LOW — read-only, in-scope, auto-executed, and audit-logged. If I asked it to delete a file —"

**Stage:** Type: "Delete C:\\Windows\\System32\\drivers"

**On screen:** Assistant returns a templated refusal, also LOW-badged because the refusal itself is a read-only output. A small `request_refused` audit row is written silently.

**Say:**
> "— it refuses with a templated message and writes an audit row. The student can't trick the assistant into out-of-scope work because the tool whitelist is hard-coded, not LLM-discovered."

---

## Segment 2 — Perception event: USB insertion (2:00 – 2:45)

**Stage:** Plug a USB into the demo laptop. (Or click the stage **Simulate USB** button if hardware unreliable — same code path either way.)

**On screen:** Three things happen in sequence:
1. A small "Agent active" pill appears in the student dashboard topbar.
2. The Action Timeline component slides up from the bottom, showing:
   - **▸ Perception**: USB inserted — SanDisk 16GB at 21:34:05 ✓
   - **▸ Reasoning**: Scanning with ClamAV... ⏳ (spinner)
3. A `usb_inserted` row writes to the audit log.

**Say:**
> "Perception event — pyusb in the Python sidecar detected the device, fired an event over IPC. The agent doesn't just react to clicks. It perceives system events. Now the reasoning stage —"

---

## Segment 3 — Reasoning + Risk classification (2:45 – 3:30)

**On screen:** ClamAV completes the scan. Action Timeline updates:
- **▸ Reasoning**: ClamAV detected `Eicar-Test-Signature`. Action proposed: `quarantine_usb`. Risk: **HIGH** (red badge).

**Say:**
> "ClamAV found EICAR — the industry-standard harmless test signature, used everywhere for AV verification. The risk classifier — deterministic rule table, no opaque ML — flagged this HIGH because: scope is the user's session, the action is irreversible (quarantine), and there's a confirmed threat. HIGH means this action does NOT auto-execute."

**On screen:** Action Timeline updates:
- **▸ Action**: Risk HIGH → escalating to admin Approvals Queue ⏳

A non-blocking banner appears on the student dashboard:
> "Your USB is held for safety review. An administrator has been notified. You can continue using the assistant for academic questions."

**Say:**
> "This is the HITL gate — bounded autonomy. The agent could act, but on HIGH-risk we require a human. Crucially, the student's experience isn't fully blocked — the assistant remains usable for academic chat, which is LOW risk. The dangerous artifact is held; the productivity work continues."

---

## Segment 4 — Admin Approvals Queue (3:30 – 5:30)

**Stage:** Click avatar → Logout. (In production, a different physical admin terminal; for the demo, role switch on the same machine.)

**Say (during transition):**
> "I'm switching to the admin role. In a real lab this is a different physical machine — the queue is shared infrastructure."

**Stage:** Login as `admin@runa.edu.ph` / `runa-admin`.

**On screen:** Admin Dashboard. Sidebar shows a red "1" badge on **APPROVALS QUEUE** (new sidebar item).

**Stage:** Click **APPROVALS QUEUE**.

**On screen:** Queue panel showing one pending request:

```
┌─────────────────────────────────────────────────────────────┐
│ Pending Approvals (1)                                       │
├─────────────────────────────────────────────────────────────┤
│ #a8f3-2e91 · 21:34:09 · HIGH                                │
│                                                             │
│ Requester:   student@runa.edu.ph                            │
│ Action:      quarantine_usb                                 │
│ Target:      SanDisk 16GB (serial: 070D2C3E1A)              │
│                                                             │
│ Evidence:                                                   │
│   ClamAV scan (Eicar-Test-Signature)                        │
│   sha256: a591a6d40bf420404a011733cfb7b190…                 │
│                                                             │
│ Reasoning:                                                  │
│   Auto-classified HIGH because:                             │
│   - threat detected (rule R12)                              │
│   - scope = session                                         │
│   - reversible = false                                      │
│                                                             │
│   [Approve]   [Reject]   [Request more info]                │
└─────────────────────────────────────────────────────────────┘
```

**Say:**
> "The admin sees everything — requester, requested action, supporting evidence, the agent's reasoning, the risk-classification rule that fired. Three options: approve, reject, or ask for more info — which puts a comment thread on the request and re-queues it."

**Stage:** Click **Approve**.

**On screen:** Toast: "Action approved. quarantine_usb executing." After ~1s, second toast: "USB quarantined. Student notified." Tray notification balloon also fires.

**Say:**
> "The action just executed — Python sidecar called `usb-quarantine`. Two audit rows wrote: `action_approved` and `action_executed`, both linked by the same `approvalId`. Let me show you that —"

**Stage:** Click **AUDIT** in the sidebar.

**On screen:** Audit Trails table with the new HITL columns visible. The top three rows:

| createdAt | eventType | actor | role | approvalId | approver | risk |
|---|---|---|---|---|---|---|
| 21:35:11 | action_executed | student@... | agent | a8f3-2e91 | admin@... | HIGH |
| 21:35:09 | action_approved | admin@... | admin | a8f3-2e91 | admin@... | HIGH |
| 21:34:09 | action_proposed | student@... | agent | a8f3-2e91 | — | HIGH |

**Say:**
> "Three rows for one approval. Two-party non-repudiation: the agent that proposed it, the admin that approved it, the system that executed it. Same `approvalId` reconstructs the chain. In Phase 2, each row carries a chained sha256 hash for tamper-evidence — the schema column is already there, the implementation is on Day 5."

---

## Segment 5 — Admin assistant (operational mode) (5:30 – 7:00)

**Stage:** Click **ASSISTANT** in the admin sidebar.

**On screen:** Same Productivity Assistant component, admin context. The scope statement above the chat input now reads:
> "Admin mode: 5 operational tools (summarize_audit, explain_alert, recommend_response, draft_policy, propose_action). HIGH-risk proposals route through the Approvals Queue."

**Stage:** Type: "Summarize today's audit log."

**On screen:** ~2s spinner, then a paragraph response:
> "In the past 30 minutes: 1 student session opened (student@runa.edu.ph), 1 USB perception event with HIGH-risk quarantine action approved (approvalId a8f3-2e91), and 2 LOW-risk chat interactions on the student assistant. No sustained policy violations. Recommended posture: continue monitoring; no operator action required."

The response carries a LOW RiskBadge.

**Say:**
> "Admin assistant. Same component, different system prompt, different tool whitelist. This response is LOW because it's a read-only summary — Claude on Bedrock parsed the audit log and produced a paragraph. Now watch what happens if I ask it to do something dangerous —"

**Stage:** Type: "Lock the entire COMLAB 08."

**On screen:** Assistant responds:
> "I cannot execute lock_cluster directly — this is a HIGH-risk action. I have queued the proposal for admin approval. See your Approvals Queue."

The badge on the message is HIGH (orange/red).

**On screen:** Approvals Queue badge in sidebar increments to "1".

**Say:**
> "Even when the admin asks the assistant to do something HIGH-risk, the assistant doesn't execute — it queues. The same admin would have to go to the queue and approve their own request. That's the two-party pattern: protects against accidental acknowledgments, creates a non-repudiable audit trail. In production the proposer and approver are different people."

> If running short on time, skip clicking through the second approval. Just point at the queue badge and move on.

---

## Segment 6 — Closing (7:00 – 8:00)

**Stage:** Click **AUDIT** one more time. Scroll the table.

**Say:**
> "What you saw exercises every Specific Objective in the rationale. SO1 — the five core modules each have shells. SO2 — bounded agentic architecture: Perception, Reasoning, Action, all on screen, all logged. SO3 — risk classification distinguishes low-risk autonomous from high-risk HITL. SO4 — governance safeguards: tool whitelists, audit log with HITL extensions, consent banner, RA 10173 footer. SO5 — usability work continues into the formal evaluation."

**Stage:** Click avatar → Logout. Land on RUNA login screen.

**Say:**
> "The literature review identified three gaps Runa fills: scope (no integrated platform combines all four operational modules), agentic deployment (no bounded agentic prototype for university labs), and local governance (no Philippine HEI work engages with RA 10173 as a design constraint). What you saw is the prototype occupying that intersection. Happy to take questions."

---

## Anticipated Q&A — pre-baked answers

> Cross-reference: `agentic-architecture.md` §9 has the full agentic-specific Q&A. The table here covers infrastructure questions.

| Q | A |
|---|---|
| "Where exactly is the agentic behavior?" | "The Productivity Assistant chat panel (in both student and admin modes) and the security agent that handled the USB insertion. Both run on a Perception-Reasoning-Action cycle visible in the Action Timeline. The agent doesn't just react to clicks — it perceives system events, reasons about them via tool selection and risk classification, and acts within bounded permissions." |
| "What stops the agent from doing something dangerous?" | "Three layers. Tool whitelist — fixed, hard-coded per role. Risk classifier — deterministic rule table. HITL gate — every HIGH action is BLOCKED in the Approvals Queue until an admin clicks Approve. The agent literally cannot wipe a terminal even if instructed to — there's no 'execute' tool in its registry." |
| "Is the data real or mocked?" | "The audit log, session, security policy, and Approvals Queue are real and persisted to local storage. The dashboard occupancy gauges and the four-lab status grids are seeded with deterministic demo data — those would be backed by DynamoDB queries in production." |
| "Why a Python sidecar instead of pure Node?" | "ClamAV bindings, AWS Bedrock SDK, and pyusb all have first-class Python ecosystems. Spawning a Flask service over loopback gives us those libraries without forcing the renderer to know about them." |
| "What auth do you use?" | "For the demo, two hardcoded role accounts. The architecture is built for AWS Cognito — the session payload already has `token` and `expiresAt` fields in the right shape. Cognito wiring is Phase 2 of the thesis timeline." |
| "What about offline mode?" | "Local SQLite (or electron-store JSON) holds session, settings, audit, policies, and the Approvals Queue. The app is fully functional offline; it only needs network for Bedrock AI tasks. If Bedrock is unreachable, the assistant falls back to a static response and labels it as such." |
| "How do you prevent students from killing the Electron process?" | "Kiosk mode + single-instance lock + tray restart. In production the Electron app would be auto-relaunched by a Windows service, and the student account would not have permission to kill it." |
| "Why not browser instead of Electron?" | "We need OS-level kiosk, native file dialogs for scans, the system tray for background alerts, native USB enumeration via the Python sidecar, and a custom titlebar for branding. A browser tab can't do those." |
| "Is the data scanned by the engine the EICAR test file?" | "Yes — EICAR is the industry standard harmless test signature. ClamAV detects it as `Eicar-Test-Signature`. We use it because real malware in a demo would be irresponsible." |
| "How does this comply with RA 10173?" | "Three places. First, the consent banner on first launch logs `consent_given`. Second, the data minimization principle is enforced at the audit-row schema level — we never log user-typed chat content beyond the active session. Third, the governance footer surfaces retention period and role. The literature review identified Philippine HEI work not engaging with RA 10173 as a research gap; Runa's governance design fills it." |
| "What if the admin is offline when a HIGH action is needed?" | "The Approvals Queue persists. The student sees 'Your action is queued' and the dangerous artifact stays held. Phase 2 adds a tiered escalation policy — if no admin acts within N hours, the request routes to a higher role or auto-rejects with notification. We never auto-approve at any tier." |

---

## Recovery scripts (if something breaks live)

**If the assistant doesn't respond:**
> "The Bedrock service is intermittent — let me show you the cached fallback." → The assistant should already have a 5s timeout that returns a static labeled response. Continue from there.

**If the USB perception doesn't fire:**
> "The pyusb event is hardware-dependent — let me trigger it manually." → Click the stage **Simulate USB** button in the corner. Same code path.

**If the queue is empty after Approve:**
> "Let me refresh the queue view." → Click APPROVALS QUEUE again to re-fetch. If still broken, switch to AUDIT directly and narrate the rows that DID write.

**If the window crashes:**
> "Let me restart — this is exactly why the single-instance lock matters." → Double-click `run-demo.bat`, the app comes back up with the persistent session intact, you continue from where you crashed. The pending approval also survives.

**If Python service is down (red health dot):**
> "The sidecar's down — give me one second." → Open the Python terminal, hit Up + Enter to relaunch. Continue.

**If everything goes catastrophically wrong:**
> "Rather than fight the live demo, let me show you the recorded version — same flow, captured this morning." → Switch to backup video.

---

## Post-demo cleanup

- [ ] Stop `npm run dev` / `run-demo.bat`.
- [ ] Kill the Python process (`taskkill /IM python.exe`).
- [ ] Re-enable Windows Defender + Windows Update.
- [ ] Save the audit log: copy the SQLite file (or `electron-store` JSON) to a backup folder labeled with the demo date for the thesis defense write-up.
- [ ] Note which Q&A questions came up that weren't on the pre-baked list — add them for the next demo.
- [ ] Eject the USB stick safely.
