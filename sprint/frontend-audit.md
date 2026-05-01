# Frontend Audit — Resize & Functionality Gaps

A read-only sweep of `src/app/components/**` and the layout chain (`App.tsx` → `Root` → page → panels). Captures every concrete responsiveness bug, dead/decorative button, and behavioral gap I can verify from the source. **Each item is paired with a question to answer before we touch code** so we don't fix things the wrong way.

> Scope: this is for Day 2 (or a Day 1.5 polish slice) — fixes are NOT made in this document. Decide answers below, then we batch the fixes in one pass.

---

## A. Layout & Resize Bugs (root-cause first)

### A1. `min-h-screen` inside a fixed-height parent — **the headline bug**

`src/app/App.tsx` defines:

```16:24:src/app/App.tsx
export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <RouterProvider router={router} />
      </div>
    </div>
  );
}
```

The `<div style={{ flex: 1, overflow: "hidden" }}>` available height is `100vh - 36px` (titlebar). But every page inside it uses **`min-h-screen` (= `min-height: 100vh`)**:

- `LoginPage.tsx:31` — `min-h-screen w-full flex flex-col`
- `AccessCodePage.tsx:124` — `min-h-screen w-full flex flex-col`
- `Dashboard.tsx:87` — `flex flex-col min-h-screen`
- `StudentDashboard.tsx:95` — `flex flex-col min-h-screen`

Effect: every page is forced to be **36 px taller than its container**, then clipped by the parent's `overflow: hidden`. You see the bottom 36 px (typically the footer/taskbar) get cut off, and on smaller windows the cumulative effect is much worse because the fixed-height header (h-14 = 56 px) and footer (h-11 = 44 px) eat the visible area but the content still thinks it has a full viewport.

**Fix family:** swap `min-h-screen` → `h-full` (or `min-h-0 h-full`) on all four page roots. Verify the bottom taskbar in `Dashboard`/`StudentDashboard` is no longer clipped on a 1024×680 window.

**Question A1.** Are we OK with the windowing assumption that the React root always lives below a 36 px titlebar (Electron only), or do we need the pages to also work standalone in a browser tab during dev? *(If the latter, we need a TitleBar height variable that resolves to 0 outside Electron.)*

---

### A2. Hard-coded sidebar widths break narrow windows

| Component | Left rail | Right rail | Total chrome |
|---|---|---|---|
| `Dashboard.tsx:196,247` | 88 px | 215 px | **303 px** |
| `StudentDashboard.tsx:207,258` | 72 px | 215 px | **287 px** |
| `SettingsPanel.tsx:445` | 220 px | — | 220 px |

The Electron `minWidth` is 1024 px (`electron/main.ts`). At minimum width that leaves the admin main panel only **~720 px**, which is below the natural width of every `LabDashboard` / `LabMonitoring` / `AccessControl` / `AuditTrails` content layout (see A3).

**Fix family:** either lower the minWidth and accept reflow at narrow sizes, or add `lg:w-[215px] md:w-[160px] sm:w-12` style breakpoints, or hide the right rail entirely below 1280 px.

**Question A2.** What is the **target demo resolution**? If the demo machine is 1920×1080 and we'll never run smaller, we can leave fixed widths and only fix overflow. If it could be a 1366×768 projector, we need responsive collapse.

---

### A3. Inner content grids never reflow

Hard-coded grid columns that do not adapt:

| File | Line | Pattern | Risk at narrow width |
|---|---|---|---|
| `LabDashboardPanel.tsx:130,191` | `grid grid-cols-2 gap-5` | 4 ComLab grids stack 2-up, never 1-up | At <900 px each lab card is so narrow the 8-column PC grid becomes squashed |
| `LabMonitoringPanel.tsx:168` | `grid grid-cols-3 gap-5` | "Terminal Matrix col-span-2 + Live Attendance" | Below ~1100 px the attendance column is unreadable |
| `LabMonitoringPanel.tsx:188` | `gridTemplateColumns: "repeat(6, 1fr)"` | 30 PCs in 6 cols | 5 rows of PCs render as ~70 px wide tiles at narrow width |
| `AccessControlPanel.tsx:108` | `gridTemplateColumns: "1fr 280px"` | Node matrix + command override stacked | Below ~1080 px the 280 px rail eats >40% of the main pane |
| `AccessControlPanel.tsx:127` | `repeat(8, 1fr)` for 40 nodes | 5 rows × 8 cols | Same issue as LabMonitoring |
| `AccessControlPanel.tsx:165` | `grid-cols-3` for Active Nodes / Hits / Solar | Numbers truncate | "1,248" + "Solar Nodes 82" labels overlap |
| `AuditTrailsPanel.tsx:298` | `gridTemplateColumns: "220px 1fr"` | Stats column left, table right | Below ~1100 px the 220 px stats column squeezes the 5-col table off-screen |
| `AuditTrailsPanel.tsx:413,435` | `"110px 1fr 100px 130px 90px"` | Audit table columns sum to 430 px + 1fr | Below ~700 px main pane the rightmost columns clip; horizontal scrollbar appears in an `overflow-y-auto`-only container — won't scroll |

**Fix family:** add Tailwind responsive variants (`lg:grid-cols-2 md:grid-cols-1`) and prefer `auto-fit, minmax(...)` for PC matrices so cells maintain a sane minimum width.

**Question A3.** Is reflowing the dashboards to a single column on narrow widths acceptable for the demo, or must they always look "panoramic"? The demo aesthetic relies on the wide command-deck look — collapsing might undermine the visuals.

---

### A4. Modals / popovers that may clip or layer wrong

- `NotificationPanel.tsx:226-237` — `width: 360px, maxHeight: 520px`, anchored `absolute top-full right-0` to the bell. Inside the header `h-14` (only 56 px tall). If the parent has any `overflow` or `transform`, the dropdown clips.
- `SettingsPanel.tsx:425` — uses `fixed inset-0 z-50` with `width: min(900px, 95vw)`. Good — adapts to screen size. ✓
- `AccessControlPanel.tsx:343,374` — Lock/Terminate confirm modals: hard-coded `width: 340px`, no max-width clamp.
- `Dashboard.tsx:226-241` — "System log notification" pinned `absolute bottom-4 left-4 z-10` inside the main `<main>`. On short content panels (e.g. AuditTrails table empty) it can overlap legitimate content.
- `ToastContainer` at `z-[100]` is above everything else — good, but it's positioned `bottom-16 right-5` which collides with the same area as the System Log notification card.

**Question A4.** The "System Log" pill in `Dashboard.tsx` is decorative ambience. **Keep it, hide it, or move it into a real status bar**?

---

### A5. NotificationPanel "outside click closes" race condition

```215:224:src/app/components/NotificationPanel.tsx
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);
```

The bell button is outside `panelRef`. So clicking the bell to **toggle** the panel triggers BOTH:
1. `NotificationBell.onClick` → `onOpen` → `setShowPanel(v => !v)` (toggles)
2. `document.mousedown` → `onClose` → `setShowPanel(false)`

Net effect: once the panel is open, clicking the bell again **always closes** it (correct), but if the panel is closed and you click the bell, the listener mounted on the previous open run may have just unmounted in time… or may not. The order is undefined. Manual repro: open notification panel, click bell rapidly — sometimes it stays open, sometimes it flickers closed.

**Fix family:** either add a `data-bell` attribute and ignore mousedown originating from it, OR move the bell button INSIDE the same `panelRef` wrapper, OR replace the manual listener with Radix Popover.

**Question A5.** Is the notification panel's open/close behaviour important to the demo? If we're not demoing notifications heavily, we can defer.

---

### A6. Z-index hierarchy is ad-hoc

| Element | z-index |
|---|---|
| System Log card (Dashboard) | `z-10` |
| Notification panel | `z-50` |
| Settings panel modal | `z-50` |
| Access-control confirm modals | `z-50` (same!) |
| Toast container | `z-[100]` |

Two different overlays at z-50 mean order-of-mount decides who's on top. Worst case: open Settings, then trigger a Lock Cluster confirm — confirm renders behind Settings.

**Fix family:** define a small token set in `theme.css` (e.g. `--z-toast: 100; --z-modal: 60; --z-popover: 50; --z-banner: 10`) and use them.

**Question A6.** Are there flows in the demo where two overlays could open at once? (Probably not — but worth defining tokens anyway.)

---

## B. Dead / Inert Buttons (functionality gaps)

These look interactive but do nothing. Each one is a candidate for either (a) wire to a real handler, (b) make it visually decorative, or (c) remove.

### B1. `LoginPage.tsx`

| Line | Element | Status | Recommendation |
|---|---|---|---|
| 211-219 | "Recovery Flow" button (right of Persistent Session) | **No `onClick`** | Either link to a stub page or remove. Demo doesn't include account recovery. |

### B2. `Dashboard.tsx` (admin)

The 4 sidebar items + footer dock buttons are correctly wired (`setActiveNav`). The Logout button exists and works (placeholder `navigate("/")` — Day 2 swaps in `session.clear()`).

The **header Settings cog** correctly opens `SettingsPanel`. ✓

### B3. `LabDashboardPanel.tsx`

| Line | Element | Status |
|---|---|---|
| 196 | `<MoreHorizontal />` button on Recent Security Events card | **No `onClick`** |

**Question B3.** Should the kebab open a "filter / clear / export" menu, or just be removed?

### B4. `LabMonitoringPanel.tsx`

| Line | Element | Status | Recommendation |
|---|---|---|---|
| 84 | RefreshCw button (top-right of Monitoring panel) | **No `onClick`** | Easy: re-roll `pcs` state or re-fetch data. Good to wire. |
| 95-121 | The 4 COMLAB tabs (08, 09, 10, 11) — `onClick={() => setActiveTab(lab.id)}` | **OK ✓** | They DO switch tabs. |
| 301 | "VIEW FULL CLASS (n)" — wrapped in `<p>` not `<button>` | Decorative | Either make it a real button to a "full attendance" view or restyle as a label. |
| 322-327 | **WIPE TERMINAL** button | **No `onClick`** | Wire on Day 4 (audit-log + tray notification per `steps.md` §4.5). |
| 328-333 | **IGNORE OVERRIDE** button | **No `onClick`** | Decide per Question B4 below. |
| 346-352 | The X to dismiss the alert banner — `onClick={() => setShowAlert(false)}` | **OK ✓** | |

**Question B4.** What should "IGNORE OVERRIDE" do? Options:
1. Just close the alert (same as the X) — simplest, but redundant.
2. Log an audit row "alert ignored", close the alert.
3. Remove it entirely. Demo flow only needs WIPE.

### B5. `AccessControlPanel.tsx`

| Line | Element | Status | Recommendation |
|---|---|---|---|
| 84-105 | The 4 COMLAB tabs (8, 9, 10, 11) | **No `onClick`** — all tabs are pure visual; clicking does nothing | Either wire `setActiveTab` like in LabMonitoring, or hard-lock to COMLAB 08 and label it. |
| 219-234 | **Lock Cluster** tile | `onClick={() => setLockConfirm(true)}` ✓ | Will be wired to real persistence on Day 4. |
| 237-254 | **Terminate All Sessions** tile | `onClick={() => setTerminateConfirm(true)}` ✓ | Same as above. |
| 269-298 | Node Health Summary rows | Decorative | Fine — they're stats. |
| 302-336 | "Available Actions" legend | Decorative ✓ | Fine — it's a legend. |

**Question B5.** Make the COMLAB tabs in Access Control switch context (like LabMonitoring does), OR lock to COMLAB 08 and call it the demo lab? The right-pane "Command Override" semantically only applies to one lab at a time.

### B6. `AuditTrailsPanel.tsx`

| Line | Element | Status | Recommendation |
|---|---|---|---|
| 220-233 | The 4 ComLab tabs | `onClick={() => { setActiveTab(lab); setPage(1); }}` ✓ | OK |
| 236-243 | "FILTER BY DATE" button | `onClick={() => setShowDateFilter(...)}` ✓ | OK — opens date picker panel |
| 277-281 | "APPLY FILTER" button in date panel | `onClick={() => setPage(1)}` — **doesn't actually filter rows by date** | The state `dateFrom`/`dateTo` is captured but never used to filter `logs`. Either wire it (compare against a parsed `inTime` / `outTime`) or label it "demo only". |
| 282-288 | "CLOSE" button in date panel | `onClick={() => setShowDateFilter(false)}` ✓ | OK |
| 378-405 | "Export CSV" button | Inline CSV builder + `URL.createObjectURL` ✓ | **Real action — keep**. |
| 467-472 | Per-row "LOCK" button | **No `onClick`** | Decide per Question B6 below. |
| 473-478 | Per-row "AUDIT" button | **No `onClick`** | Same. |
| 479-481 | Per-row `MoreVertical` kebab | **No `onClick`** | Same. |
| 488-510 | Pagination — page numbers wired ✓; `PREV` and `NEXT` are `<span>`, not buttons | Decorative labels around real numbered buttons | Either make PREV/NEXT real (decrement/increment `page`) or remove the labels. |

**Question B6.** What should per-row LOCK / AUDIT do? Options:
1. LOCK fires `audit.log("station_locked", station, ...)` and shows a toast.
2. AUDIT pops a modal with the full event payload.
3. Remove both, keep only Export CSV — simplest.

### B7. `StudentDashboard.tsx`

| Line | Element | Status |
|---|---|---|
| 209-229 | App icons sidebar (5 fake apps) | `setActiveApp` ✓ | OK — switches the rendered fake window |
| Footer dock | Same icons | `setActiveApp` ✓ | OK |
| Logout in dropdown | `navigate("/")` | Day 2 wiring | |

### B8. `AppWindows.tsx` (the 5 fake app windows)

These are deliberate visual mocks. None of the file-tree clicks, address bar inputs, or window-control buttons (min/max/close inside fake VS Code) do anything — and that's by design. **No fix needed**, but consider adding a small "Demo View" overlay so panelists understand they're not real applications.

**Question B8.** Add a "DEMO" badge to fake app windows, or leave them as-is and explain in narration?

### B9. `SettingsPanel.tsx`

Most controls are real (toggles update state). However:

| Line | Element | Status |
|---|---|---|
| 331 | Dark mode toggle — `onToggle={() => {}}` | **Disabled** intentionally (`darkMode` const, not state) |
| 163, 177, 205, 261, 271-272, 334-341 | All `ChevronRight`-only rows | Decorative — clicking does nothing. UX-acceptable for a Windows-Settings clone but inconsistent: the toggle rows look the same as drilldown rows. |

**No real Kiosk Mode toggle exists yet.** This is on the Day 4 list (`steps.md` §4.4). The IPC `settings.set({ kioskMode })` is wired in main.ts, but there's no UI control yet.

**Question B9.** Where should the Kiosk Mode toggle live? Top of `SystemContent`? A new "Lab Mode" category? Or just a button in the Privacy & Security category?

---

## C. State / Architecture Gaps

### C1. `useNotifications` is per-component, not global

`Dashboard.tsx:60` and `StudentDashboard.tsx:78` each call `useNotifications()` separately. They have **independent** notification arrays that don't sync. Toasts triggered from a deep panel (e.g., `Scan File` on Day 3) can't reach this hook unless we lift it to a Context.

`steps.md` §4.7 already calls this out as Day 4 work, but if we want toasts from Day 3 it must move earlier.

**Question C1.** Lift `useNotifications` into a top-level `NotificationProvider` in `App.tsx` **on Day 2** (so Day 3's Scan File toast just works), or wait for Day 4?

### C2. Random data on each mount

| File | Pattern |
|---|---|
| `LabDashboardPanel.tsx:83-85` | `useState(() => comlabs.map((c) => generateGrid(...)))` — fixed per mount, but re-rolls each time you navigate away+back |
| `LabMonitoringPanel.tsx:52` | `useState(() => generatePCs(30, 0))` — same |
| `AccessControlPanel.tsx:26` | `const nodes = genNodes(40)` — at module scope, so stable across mounts ✓ |

`AccessControlPanel.tsx` got it right (module-scoped). The other two re-randomize on remount, which means rehearsal screenshots vary.

**Fix family:** convert all three to deterministic `STATIC_GRIDS` arrays (Day 4 polish, `steps.md` §4.1).

### C3. `formatRelativeTime` doesn't tick

`NotificationPanel.tsx:94-102` returns "5m ago" based on `Date.now()` at render time. But the panel doesn't re-render on a timer, so the value freezes between interactions. Minor, but visible if a panelist watches the panel for 30+ seconds.

**Question C3.** Worth adding a 30s `setInterval` to the NotificationPanel for a slow re-render? Or accept the frozen labels?

### C4. Login validation does nothing

`LoginPage.tsx:18-25`:
```tsx
const handleSignIn = (e: React.FormEvent) => {
  e.preventDefault();
  if (role === "admin") navigate("/dashboard");
  else navigate("/student-dashboard");
};
```
Empty fields still navigate. This is fixed on Day 2 (the auth wiring), but worth noting if anyone tests Day 1 build.

### C5. `crypto.randomUUID()` requires HTTPS or localhost in browsers

We'll use this in `LoginPage` Day 2 to generate session tokens. Inside Electron `file://` it's fine; in the dev `http://localhost:5173` it's also fine. Just flagging.

---

## D. Visual / UX nits

### D1. Inconsistent font-size scale

Mix of inline `style={{ fontSize: "11px" }}` and Tailwind `text-[11px]`. Hardcoded values everywhere (`8px`, `9px`, `10px`, `11px`, `12px`, `13px`, `14px`, `26px`, `36px`, `42px`, `80px`). On a high-DPI display these are tiny; on a projector they could be illegible.

**Question D1.** Add a single base font-size CSS var (`--text-xs: 0.75rem`) and use rem units everywhere, OR leave as-is for the demo and revisit post-thesis?

### D2. The "RUNA" watermark inside login is huge

`LoginPage.tsx:44`: `fontSize: "clamp(180px, 25vw, 340px)"`. On a 1024 px width, that's `25vw = 256px` — fine. On 1920 px it caps at 340 px — fine. But the watermark sits behind the layout with `z-index: 0` and the form is `z-10` — when window is short (e.g. 680 px), the watermark may bleed under the form awkwardly.

### D3. Missing focus styles

Most buttons rely on hover states only. Tab-key navigation produces no visible focus ring. Accessibility issue, but not demo-blocking.

### D4. Inline-styled colors with `color + "20"` opacity hack

E.g. `background: cfg.bg`, `color: cfg.color + "20"`. Works in modern browsers but appends "20" as the alpha hex byte. Fragile if color values aren't 6-hex. Not broken anywhere I can see, just brittle.

---

## E. Existing scrolling behavior

Components that internally manage scroll (`overflow-y-auto`):
- `Dashboard.tsx:222` `<main>` — ✓ correct
- `StudentDashboard.tsx:233` `<main>` — ✓ correct
- All four panels (LabDashboard / LabMonitoring / AccessControl / AuditTrails) wrap their root in `h-full overflow-y-auto` — **✓ correct**, but combined with A1's `min-h-screen` parent they currently don't scroll properly because the parent itself overflows.

After A1's fix, scroll should "just work" inside each panel.

---

## Suggested fix order (if we batch this all into one pass)

1. **Layout overflow (A1, A2 partial)** — change `min-h-screen` → `h-full` in 4 files. Verify on 1024×680 and 1920×1080.
2. **Lift NotificationProvider (C1)** — moves from Day 4 to today so Day 3 toasts work.
3. **Wire dead but easy buttons (B3, B4 RefreshCw, B5 COMLAB tabs, B6 PREV/NEXT)** — small wins, makes demo feel polished.
4. **Decide & wire WIPE TERMINAL (B4)** + **per-row LOCK/AUDIT (B6)** — answer Question B4/B6 first.
5. **Responsive grid breakpoints (A3)** — only if Question A2 mandates narrow-window support.
6. **Z-index tokens (A6)** — tiny CSS change.
7. **Defer to Day 4:** static seed data (C2), Kiosk toggle UI (B9), focus styles (D3).

---

## All open questions in one place

- **A1.** TitleBar always present (Electron-only assumption), or must pages also work standalone in a browser tab?
- **A2.** Target demo resolution? 1920×1080 only, or could be 1366×768?
- **A3.** Reflow dashboards to single column at narrow widths, or always panoramic?
- **A4.** The "System Log" decorative pill — keep, hide, or move?
- **A5.** Is notification panel UX a demo concern? Otherwise defer the click-race fix.
- **A6.** Multi-overlay cases worth defining z-index tokens upfront?
- **B3.** `MoreHorizontal` kebab on Recent Security Events — wire to a menu, or remove?
- **B4.** What does "IGNORE OVERRIDE" do? Just close, log "ignored", or remove?
- **B5.** Access Control COMLAB tabs — switch context or lock to one lab?
- **B6.** Per-row LOCK / AUDIT in Audit Trails — wire, repurpose, or remove?
- **B8.** Add "DEMO" badge to fake VS Code / Chrome / etc. windows, or narrate it?
- **B9.** Where does the Kiosk Mode toggle UI live in Settings?
- **C1.** Lift `useNotifications` to a Provider today (Day 2), or wait until Day 4?
- **C3.** Tick relative-time labels every 30 s, or accept frozen values?
- **D1.** Switch to rem-based font scale, or leave as-is for demo?

Answer these (even just "skip" / "defer" / "remove"), and we have a concrete fix plan for the next coding pass.
