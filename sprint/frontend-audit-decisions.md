# Frontend Audit — Best-Practice Decisions

Companion to `frontend-audit.md`. Each of the 15 open questions answered with a recommendation framed for the **thesis proposal defense** (assesses feasibility & progress of the Agentic RPA), and an explicit tier so we know when to execute.

---

## Guiding principles for the defense

1. **Real architecture beats polished mocks.** Panelists score "does the system actually work end-to-end" higher than "does it look pretty." Every interactive element should be either **fully wired** or **removed**. "Looks clickable but does nothing" is a worse outcome than "absent."
2. **Lean kiosk-first.** This is a desktop app for a fixed institutional resolution. Don't burn time on responsive design that the production target doesn't need.
3. **Lock the demo path before polishing branches.** If a button isn't on the demo script, defer or delete.
4. **Cut, don't carry.** Every dead button you leave invites a panelist question you can't answer well.

---

## Decisions (in audit order)

### A1. TitleBar always present (Electron-only)?

**YES — Electron-only assumption.** `TitleBar.tsx` already returns `null` outside Electron, so the browser-dev case "just works" once we change `min-h-screen` → `h-full`. No special-case math needed.

- **Action:** Change `min-h-screen` → `h-full` in `LoginPage.tsx`, `AccessCodePage.tsx`, `Dashboard.tsx`, `StudentDashboard.tsx`.
- **Tier 1 (today)** · **15 min**

---

### A2. Target demo resolution?

**1920×1080.** This is the standard projector/laptop output and matches the kiosk-deployment target in the thesis. Bump Electron `minWidth: 1024 → 1280` so the dev experience matches.

- **Why:** A "kiosk lab management portal" that requires < 1280 px is unrealistic for the actual deployment context (school computer labs use 1080p or higher).
- **Defense framing:** "We target the institutional standard 1080p; the kiosk is full-screen so reflow below this is out of scope."
- **Action:** Edit `electron/main.ts` `minWidth: 1280, minHeight: 800`.
- **Tier 1 (today)** · **2 min**

---

### A3. Reflow dashboards on narrow widths?

**SKIP.** Follows from A2 — at the target resolution all current grid layouts fit comfortably. Adding `sm:`/`md:` variants is hours of work that wouldn't be exercised during the demo or in production.

- **Defense framing:** "The application is full-screen kiosk; reflow is unnecessary."
- **Action:** None. Documented as deliberate non-goal.
- **Skip**

---

### A4. The "System Log" decorative pill in `Dashboard.tsx`?

**REMOVE.** Two reasons:
1. It's pure mock content with no data — clutters the demo and overlaps with the **real** ToastContainer that will fire during Scan File on Day 3.
2. It contradicts the "real architecture" message — it claims "All actions are logged" but the toast that proves logging is now hidden behind it.

- **Defense framing:** Delete invites the question "where do real logs surface?" → answer: Audit Trails panel + toast notifications + tray.
- **Action:** Delete the `<div>` block in `Dashboard.tsx` lines 226-241. Same in `StudentDashboard.tsx` (the "Persistent storage is disabled" pill).
- **Tier 1 (today)** · **5 min**

> Optional retention: keep the *student* one as a static legal/policy banner since it's a real product policy. **Recommendation: keep student, remove admin.**

---

### A5. Notification panel outside-click race?

**FIX TODAY** (we'll be working on the notification system anyway in C1).

- **Why for defense:** The Day 3 demo highlights a Python-driven scan toast. If clicking the bell flickers the panel, the moment loses impact.
- **Action:** When we lift `useNotifications` to a Provider (C1), use Radix Popover or add a `data-bell` attribute and ignore mousedown originating from it.
- **Tier 1 (today, bundled with C1)** · **20 min**

---

### A6. Z-index tokens?

**YES — define 4 tokens.** Cheap insurance against modal-over-modal collisions during demo (e.g., Settings open + Lock confirm modal triggered).

```css
:root {
  --z-banner:  10;
  --z-popover: 50;
  --z-modal:   60;
  --z-toast:  100;
}
```

- **Action:** Add to `src/styles/theme.css`. Replace inline `z-10/z-50/z-[100]` with `style={{ zIndex: "var(--z-modal)" }}` (or matching Tailwind arbitrary value `z-[var(--z-modal)]`).
- **Tier 1 (today)** · **15 min**

---

### B3. `MoreHorizontal` kebab on Recent Security Events?

**REMOVE.** No menu to populate, no demo flow uses it.

- **Defense framing:** Removing decorative widgets makes the UI honest about what works.
- **Action:** Delete the `<button>` in `LabDashboardPanel.tsx:196`.
- **Tier 1 (today)** · **2 min**

---

### B4. "IGNORE OVERRIDE" button (next to WIPE TERMINAL)?

**WIRE IT.** Removing it weakens the security narrative; the contrast between WIPE and IGNORE *is* the point — it shows admin discretion is logged.

**Behavior:**
1. `audit.log("alert_ignored", "C08-PC01", currentUserId)` (Day 3 audit infra)
2. Close the alert banner (`setShowAlert(false)`)
3. Toast: `"Alert ignored — logged for review"`

- **Defense framing:** Two side-by-side actions both audit-log → demonstrates that **all admin actions are accountable**, regardless of severity. Strong feasibility signal.
- **Action:** Add `onClick` handler in `LabMonitoringPanel.tsx:328-333` (deferred until Day 3 audit infra exists).
- **Tier 3 (Day 3 alongside WIPE TERMINAL wiring)** · **10 min**

---

### B5. Access Control COMLAB tabs?

**WIRE THEM** to switch context. Per-lab governance is core to the thesis's "agentic" claim — an admin can scope automated security policy to specific labs.

**Behavior:**
- `onClick={() => setActiveTab(lab.id)}` (add `activeTab` state).
- Lock Cluster + Terminate write `audit.log(... , { lab: activeTab })` so the persisted record knows which lab.
- The persisted "is locked" state is keyed per lab (`policy.set("comlab_${activeTab}_locked", "1")`).

- **Defense framing:** "Each command override is scoped to one lab; the system tracks lab-level governance state independently." Very strong panelist answer.
- **Action:** Add state + onClick + scope persistence keys.
- **Tier 2 (Day 4 alongside Lock/Terminate wiring)** · **30 min**

---

### B6. Per-row LOCK / AUDIT in Audit Trails + PREV/NEXT spans?

Mixed — split decision:

| Element | Decision | Why |
|---|---|---|
| **LOCK** (per-row) | **Wire it.** | Per-station granularity reinforces the security narrative. `audit.log("station_locked", log.station, ...)` + toast + grey-out the row. |
| **AUDIT** (per-row) | **Remove.** | The entire panel IS the audit view. A per-row "AUDIT" button is semantic dead weight; it would open a modal showing the same row that's already on screen. |
| **MoreVertical kebab** | **Remove.** | Same logic as B3 — no menu. |
| **PREV / NEXT** spans | **Convert to real buttons.** | Tiny fix; one decrement/increment of `page` state. Pagination should always be navigable. |

- **Defense framing:** Per-station LOCK demonstrates the system can isolate individual workstations under suspicion — exactly what an "agentic" security RPA should do.
- **Action:** ~50 LoC across `AuditTrailsPanel.tsx`.
- **Tier 2 (Day 4)** · **45 min**

---

### B8. "DEMO" badge on fake app windows?

**SKIP — narrate instead.** Adding badges is dev time spent on something panelists will infer for themselves. The fake VS Code window obviously isn't real (you can't type into the editor). Better narration than UI clutter.

- **Defense narration line:** "These five windows visually represent the whitelisted applications a student would access inside the kiosk — VS Code, IntelliJ, Chrome, Terminal, and Projects. In the production deployment they'd be embedded via Electron BrowserViews or launched as siblings; here we render visual previews to focus on the security boundary."
- **Skip**

---

### B9. Where does the Kiosk Mode toggle live?

**New "Lab Mode" category** as a new entry in the Settings sidebar (top of the list, above "System"). Dedicated page is more defensible than burying it under "Privacy & Security."

**Page contents:**
- **Kiosk Mode** toggle (calls `electronAPI.settings.set({ kioskMode })`)
- **Auto-logout after** dropdown (5/15/30 min — visual only is OK)
- A clearly-visible **"Press Ctrl+Shift+K to exit kiosk"** instruction
- Static "Lab Mode is enforced by RUNA system administrators" banner

- **Defense framing:** A dedicated Lab Mode panel reads as a deliberate product decision rather than a debug toggle. Easier to explain in 30 seconds.
- **Action:** Add new `LabModeContent` component in `SettingsPanel.tsx`; add `{ id: "labmode", label: "Lab Mode", icon: <Shield size={16} /> }` to categories array (top).
- **Tier 2 (Day 4 alongside kiosk wiring)** · **30 min**

---

### C1. Lift `useNotifications` to a Provider — when?

**TODAY.** Don't wait for Day 4. Two reasons:

1. Day 3's Scan File toast needs to be triggerable from `AccessControlPanel` — that requires a Provider, otherwise we prop-drill `pushToast` 3 levels deep.
2. Lifting now also fixes A5 (the bell race) in the same change.

**Action sketch:**
- Create `src/app/providers/NotificationProvider.tsx` exporting a Context with `notifications`, `pushToast`, `markRead`, `clearAll`, etc.
- Wrap `<RouterProvider>` in `App.tsx` with the provider.
- Replace `useNotifications()` calls in `Dashboard.tsx` and `StudentDashboard.tsx` with `useNotificationContext()`.
- Render `<ToastContainer>` once at the App level.

- **Tier 1 (today)** · **45 min**

---

### C3. Tick relative-time labels in NotificationPanel?

**YES — 30 s tick.** Trivial change, makes the panel feel alive during longer demo segments (audit walkthrough).

- **Action:** `setInterval(() => forceUpdate(), 30000)` inside `NotificationPanel`.
- **Tier 3 (Day 4 polish)** · **5 min**

---

### D1. rem-based font scale?

**SKIP.** Refactoring 13 files of inline `fontSize` strings carries high risk of visual regressions and zero defense impact. Accept as documented post-thesis tech debt.

- **Defense framing:** No question expected here. If asked: "Yes — production hardening would centralize the scale into design tokens."
- **Skip**

---

## Tiered execution plan

### Tier 1 — Today (post-audit, pre-Day 2)
**Total ~2 hours.** All low-risk, high-leverage fixes that unblock everything downstream.

1. **A1** — `min-h-screen` → `h-full` on 4 page roots
2. **A2** — bump Electron `minWidth/minHeight` to 1280×800
3. **A4** — remove the admin "System Log" pill (keep student policy pill)
4. **A6** — add 4 z-index CSS tokens to `theme.css`
5. **B3** — remove decorative kebab on `LabDashboardPanel`
6. **C1** — lift `useNotifications` to a `NotificationProvider`
7. **A5** — fix bell click race (folded into C1)

After Tier 1: visual layout is correct, notification system is centralized, decorative dead buttons removed. **Then move to Day 2 (auth).**

### Tier 2 — Day 4 (Integration & Polish, alongside roadmap)
Already on the roadmap; these audit items reinforce it:

8. **B5** — wire Access Control COMLAB tabs to switch context (with policy-key scoping)
9. **B6** — wire per-row LOCK; remove per-row AUDIT + kebab; make PREV/NEXT real
10. **B9** — add new "Lab Mode" Settings category + Kiosk toggle

### Tier 3 — Day 4 polish (last to land)
Cosmetic; do these only if all Tier 1+2 land cleanly:

11. **B4** — wire IGNORE OVERRIDE
12. **C3** — 30 s tick on notification panel relative times

### Explicit skips (do not touch)
- **A3** — narrow-width reflow
- **B8** — fake-window DEMO badges
- **D1** — rem font scale

---

## Sequencing impact on the existing sprint roadmap

| Sprint day | Was | Now (with audit decisions) |
|---|---|---|
| **Day 1** | ✅ Electron boots | ✅ Done |
| **Day 1.5 (today)** | — | **NEW: Tier 1 frontend pass (~2 h)** |
| **Day 2** | Auth + session | Auth + session (unchanged) |
| **Day 3** | Sidecar + audit log | Sidecar + audit log (toasts now "just work" thanks to C1) |
| **Day 4** | Integration + polish | Integration + polish + Tier 2/3 (slightly heavier than original plan but well-scoped) |
| **Day 5** | Build + rehearse | Build + rehearse (unchanged) |

The Tier 1 pass slots between Day 1 and Day 2 cleanly. It does not touch IPC, auth, or persistence — so there's zero rework risk when Day 2 starts.

---

## What I'm NOT recommending (and why)

| Tempting addition | Why we're skipping |
|---|---|
| Migrate everything to shadcn/ui components | The vendored kit is unused; switching would require restyling every panel and risks visual drift. Defense doesn't reward consistency rewrites. |
| Add Storybook | Demo doesn't need it, panelists don't ask for it. |
| Add E2E tests (Playwright) | A 5-day sprint with 2 days of unwired functionality cannot afford test infrastructure. Manual rehearsals (Day 5) cover this. |
| Refactor inline styles to CSS Modules | Zero defense value; high risk. |
| Add i18n | Defense is in English. PCU operates in English. |
| Real OS-level kiosk that disables Alt+Tab and Win key | Out of Electron scope without native shell hooks; demo's `setKiosk(true)` already conveys the concept. Production work. |

---

## TL;DR

- **Ship Tier 1 today** (2 h) — A1, A2, A4, A5+C1, A6, B3.
- **Skip three items entirely** — A3, B8, D1.
- **Move Tier 2 onto Day 4** — B5, B6, B9 (already roadmap-adjacent).
- **Tier 3 only if time** — B4, C3.

Net add to the sprint: ~3 hours total, in exchange for a clean, honest, panel-defensible UI where every visible interaction does something real.
