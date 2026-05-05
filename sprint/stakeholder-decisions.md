# Stakeholder decisions — sprint alignment

Canonical answers from the product owner / thesis team. **Supersedes informal chat** when planning Day 4+ work.

**Recorded:** 2026-05-03 (post–Day 3 exit verification)
**Updated:** 2026-05-05 (pre–next sprint lock)

| # | Topic | Decision |
|---|--------|------------|
| 1 | **Day 3 exit criteria** | **Passed** on the actual demo laptop (manual verification: file scan, `/ai-task`, USB panel, audit persistence). |
| 2 | **Canonical demo storyline** | **USB insert → Perception → Reasoning (scan) → Approvals → Approve → Execute** as the hero path. **File scan** remains a **backup** if USB hardware or permissions fail. |
| 3 | **`executeAction` after Approve** | **Real, production-level effects** — not console stubs. Day 4 implementation must persist observable state (e.g. policy flags, quarantine record, IPC to sidecar) and align with audit + tray narrative. |
| 4 | **Governance & consent copy** | **Real** retention, categories, and policy references (RA 10173 posture) — not lorem ipsum. Text may still be “institution template” quality but must be defensible in defense Q&A. |
| 5 | **Groq runtime** | **Yes** — defense laptop is expected to have a valid `GROQ_API_KEY` so `/ai-task` can use **Groq** in the live demo (fallback path remains for dev machines without key). |
| 6 | **Simulate USB / stage controls** | **Production-level UX** — no `NODE_ENV === 'development'` throwaway. The fallback control that fires the canonical flow when hardware is unavailable must look and behave like a first-class admin feature (labeling, confirmation, audit). |
| 7 | **Sprint documentation** | Keep `README.md`, `roadmap.md`, `daily-checklist.md`, and this file **updated** at each green milestone so bus factor and panel prep stay honest. |
| 8 | **Day 5 deliverable** | **Portable Windows `.exe`** via `electron-builder` is the **primary** artifact; `run-demo.bat` / `npm run dev` remain **Plan B** only. |

## Sprint lock updates (2026-05-05)

| # | Topic | Decision |
|---|--------|------------|
| 9 | **Sprint objective** | **Defense demo polish that is future-ready for production.** |
| 10 | **Non-negotiable flows** | (a) USB scanning storyline, (b) student productivity-assistant workflow, (c) malicious/blocked-site flow. |
| 11 | **Blocked-site implementation level** | **Actual enforcement**, not policy-only placeholder. |
| 12 | **HIGH action behavior** | If not truly implemented, **hard-fail clearly** (no fake success). |
| 13 | **MEDIUM action behavior** | **HITL required** (same queue discipline as HIGH for this sprint). |
| 14 | **Approver/proposer pattern** | **Different users/devices in demo** (student laptop proposes, admin laptop approves). |
| 15 | **Student right pane UX** | Keep **compact control tower**; on small windows use **drawer/collapse** behavior. |
| 16 | **User feedback** | Show user-visible warnings/toasts with explicit severity color coding (info/success/warn/error). |
| 17 | **AI runtime assumption** | Groq expected on defense machine; fallback still present for resilience. |
| 18 | **Persistence path** | Move to **hybrid local + Supabase Postgres** for two-runtime sync (approvals queue, audit log, blocked domains) while retaining local fallback. |
| 19 | **Git flow** | **Direct to main** for this sprint; prioritize shipping speed over branch process overhead. |
| 20 | **Repo hygiene scope** | Defer broad cleanup of unused files/deps until after demo-critical flows are green. |

## Late sprint update (2026-05-05, pause checkpoint)

- Supabase client integration is active in Electron main for shared-state reads/writes.
- Runtime issue on Node 20 (`native WebSocket` missing) was resolved by wiring `ws` transport during Supabase client creation.
- UX polish completed this pass: right-pane quick prompts removed and toast bubbles now fade out before dismissal.
- Live validation note: Groq assistant activity is now generating database records in Supabase (audit flow observed).

## Implications for `roadmap.md` / `daily-checklist.md`

- **Day 4** must prioritize: real `executeAction`, `ActionTimeline`, USB orchestrator, consent + governance footer + Settings → Privacy with **real** copy, queue-wired overrides (Lock / Terminate / Wipe), and a **polished** simulate-USB path.
- **Day 5** must prioritize **`npm run build:win`** and rehearsal on the **built `.exe`**, not only dev mode — including AV “Run anyway” rehearsal.
- **Stretch** items (e.g. chained audit hashes) stay **optional** unless Day 4 finishes early.

## Related files

- `roadmap.md` — day boundaries and exit criteria  
- `agentic-architecture.md` §7 / §13 — canonical flow and Definition of Done  
- `demo-script.md` — minute-by-minute walkthrough (should match decisions above)
