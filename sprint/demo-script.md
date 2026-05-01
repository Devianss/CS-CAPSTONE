# Demo Script — 8-minute Walkthrough

The actual minute-by-minute script the presenter follows. Includes **stage directions** (what the presenter does), **talking points** (what they say), and **expected on-screen state** (what the panel sees).

> Total target time: **8 minutes ± 1**. If it runs long, drop the optional "AI summary" segment first.

---

## Pre-stage setup (T-30 min)

1. Reboot the demo laptop. Plug in charger.
2. Disable Windows Defender real-time scan + Windows Update for the duration.
3. Launch `run-demo.bat` (or double-click the portable `.exe`).
4. Wait for both Vite + Python service consoles to print "ready."
5. Verify the RUNA login screen is showing in the Electron window.
6. Verify the green health dot in the top bar (it'll only show after admin login — so log in once, verify, log out, leave on the login screen).
7. Open a Notepad with `eicar.com` ready to scan (if ClamAV is installed) **or** any small `.txt` file (if using stub).
8. Place backup video in second monitor / Alt-Tab spot.
9. Cue card on bezel:
   ```
   1. Login admin → Lab Dashboard tour → Monitoring → Alert
   2. Access Control → Scan File → tray notif
   3. Audit Trails → show real row → Lock Cluster
   4. Logout → Login student → Kiosk + timer
   5. Logout
   ```

---

## Segment 0 — Opening (0:00 – 0:30)

**Stage:** Stand beside the laptop. RUNA login screen is showing.

**Say:**
> "This is **PCU Lab Portal**, codename **RUNA** — a desktop application that hardens and monitors our computer laboratories. It's an Electron desktop app, with a React front-end, an Electron main process for OS integration, and a Python sidecar service for security and AI tasks. I'll show you the core flows in about 8 minutes."

**On screen:** Login page with Student/Admin tabs.

---

## Segment 1 — Admin login + dashboard tour (0:30 – 2:00)

**Stage:** Click the **ADMIN** tab. Type `admin@runa.edu.ph` / `runa-admin`. Submit.

**Say (during the tab toggle):**
> "Two roles — student and admin. The admin gets a security operations console. Notice the custom titlebar — this isn't a browser tab, it's a real Electron window. The frame is hidden so we can run kiosk mode in production."

**On screen:** Admin Dashboard with Lab Dashboard panel selected — green health dot in top right, four ComLabs in 8×4 grids.

**Say (gesturing at the grids):**
> "We monitor four computer labs in real time. Each cell is a workstation — blue is active, gray idle, red alert, orange blocked. Right now COMLAB 08 has one PC in alert state. Bottom right shows lab load factor — a real-time utilization gauge. The system pulse header shows global utilization at 84%, two action alerts."

**Stage:** Brief mouse hover over the 4 sidebar icons, then click **MONITORING**.

---

## Segment 2 — Lab Monitoring & alert (2:00 – 3:30)

**On screen:** Lab Monitoring panel for COMLAB 08 — alert badge "1 INCIDENT", session timer ticking, terminal matrix with PC-01 in red.

**Say:**
> "This is the live monitoring view per lab. Currently in COMLAB 08, Prof. Anciro is teaching cybersecurity. Session time left, occupancy 18 of 30, and we have one elevated alert. Click on the red terminal —"

**Stage:** Click PC-01 (the red one).

**On screen:** Expanded alert detail card appears: "HIGH ALERT: PC-01 — Security engine detected unknown process kill_linux_skills.exe attempting to load a virtual drive. Process has been quarantined."

**Say:**
> "The Sentinel engine quarantined a suspicious process. The admin can wipe the terminal, ignore, or investigate. This is also where students appear in the Live Attendance panel on the right — name, student ID, station, IP."

**Stage:** Scroll down briefly, then click **ACCESS** in the sidebar.

---

## Segment 3 — Real Python round-trip: Scan File (3:30 – 5:00)

**On screen:** Access Control panel — Node Matrix 40 cells, Lock Cluster + Terminate buttons on the right, plus the new **Run File Scan** tile.

**Say:**
> "Now the part that's actually wired end-to-end. The desktop app talks to a local Python microservice running on port 5001. Watch the title bar — green dot means the service is alive. I'll click Scan File:"

**Stage:** Click **Run File Scan** tile.

**On screen:** Native Windows file picker opens.

**Say:**
> "This is the OS file picker, called over IPC from the renderer through Electron's main process."

**Stage:** Pick `eicar.com` (if available) or any `.txt` file.

**On screen:** ~1 second pause, then a toast notification slides in from the top right:
- If real ClamAV scan of EICAR: "Threat: Eicar-Test-Signature"
- If stub: "File clean — sha256: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"

**Say:**
> "That round-trip went: React click → Electron IPC → Python Flask → ClamAV (or stub) → SHA-256 hash + verdict → toast. And — the OS tray icon also fired a balloon notification. So even when the window is minimized, security alerts surface."

**Stage:** Glance at the system tray to confirm the notification.

---

## Segment 4 — Audit trail + admin override (5:00 – 6:15)

**Stage:** Click **AUDIT** in the sidebar.

**On screen:** Audit Trails panel — table of station logs with the file scan we just did at the top of the list.

**Say:**
> "Every action is audited. The scan I just performed is the top row, written to local persistent storage. We can filter by date, search, and export to CSV — useful for periodic security review. If I close this app and re-open it, the audit row is still here."

**Stage:** Click **Export CSV** briefly to show the download. Then click **ACCESS** again.

**Say:**
> "Two admin-only override actions: Lock Cluster freezes every workstation, and Terminate All Sessions force-signs everyone out. Watch:"

**Stage:** Click **Lock Cluster** → confirm.

**On screen:** Tile turns green with "● ACTIVE", toast says "COMLAB 08 locked".

**Say:**
> "The lock is persisted — I can close the app and the cluster stays locked until I unlock it. And it's audited — let's verify."

**Stage:** Click **AUDIT** — the new `cluster_locked` row appears at top.

---

## Segment 5 — Student kiosk experience (6:15 – 7:30)

**Stage:** Click admin avatar → Logout.

**On screen:** Login screen.

**Stage:** Click **STUDENT** tab. Type `student@runa.edu.ph` / `runa-student`. Submit.

**On screen:** Student Dashboard — duration timer counting up, sandboxed app icons (VS Code, IntelliJ, Chrome, Terminal, Projects), system policy banner "Persistent storage is disabled".

**Say:**
> "Student view is locked down. The duration of use is tracked and enforced — at 2 hours 45 minutes, we auto-logout. The student only sees the apps the admin has whitelisted — VS Code, IntelliJ, Chrome, Terminal, Projects. There's no desktop, no file explorer, no settings escape. Persistent storage is disabled, so anything saved locally is wiped at logout."

**Stage:** Click each app icon briefly (≤ 5 sec each) to show they each render their own pixel-accurate window inside the portal.

**Say:**
> "Each app runs inside the portal frame — students can't escape the sandbox. If we wanted to enforce kiosk mode at the OS level, we have a settings toggle that calls Electron's setKiosk — locks the window full-screen, kills Alt-Tab. We don't show that on stage because it makes leaving the demo painful, but it's wired up."

**Stage:** Click avatar → Logout. Land on login screen.

---

## Segment 6 — Closing (7:30 – 8:00)

**Stage:** Step back from laptop.

**Say:**
> "What you saw is a real desktop binary, real IPC, real Python sidecar, and real persistence. The full thesis scope adds AWS Cognito for auth, Bedrock-powered AI for agentic responses to security events, ClamAV daemon integration for live scanning, and DynamoDB for cross-machine audit aggregation — all foreshadowed by the architecture you just saw. Happy to take questions."

---

## Segment 7 — OPTIONAL: AI summary (only if Bedrock is wired and time allows)

> Insert this between Segment 4 and Segment 5 if rehearsals consistently come in under 7 minutes.

**Stage:** Back on Audit Trails. Click an "AI Summary" button (if implemented).

**Say:**
> "We can also ask Claude — running on Amazon Bedrock — to summarize today's audit log."

**On screen:** ~2 second spinner, then a paragraph response.

**Say:**
> "That's a Bedrock InvokeModel round-trip from the same Python sidecar, calling Claude 3.5 Sonnet. In production we'd push automated remediation suggestions back into the admin console."

---

## Anticipated Q&A — pre-baked answers

| Q | A |
|---|---|
| "Is the data real or mocked?" | "The audit log and security policy are real and persisted. The dashboard occupancy gauges and the four-lab status grids are seeded with deterministic demo data — those would be backed by DynamoDB queries in production." |
| "What auth do you use?" | "For the demo, two hardcoded role accounts. The architecture is built for AWS Cognito — the session payload already has token + expiresAt fields in the right shape. Cognito wiring is Month 2 of the thesis timeline." |
| "Why a Python sidecar instead of pure Node?" | "ClamAV bindings, AWS Bedrock SDK, and pyusb all have first-class Python ecosystems. Spawning a Flask service over loopback gives us those libraries without forcing the renderer to know about them." |
| "What about offline mode?" | "Local SQLite (or electron-store JSON) holds session, settings, audit, and policies. The app is fully functional offline; it only needs network for Bedrock AI tasks and Cognito refresh." |
| "How do you prevent students from killing the Electron process?" | "Kiosk mode + single-instance lock + tray restart. In production the Electron app would be auto-relaunched by a Windows service, and the student account would not have permission to kill it." |
| "Why not browser instead of Electron?" | "We need OS-level kiosk, native file dialogs for scans, the system tray for background alerts, and a custom titlebar for branding. A browser tab can't do those." |
| "Is the data scanned by the engine the EICAR test file?" | (If yes) "Yes — EICAR is the industry standard harmless test signature. ClamAV detects it as 'Eicar-Test-Signature.' We use it because real malware in a demo would be irresponsible." |

---

## Recovery scripts (if something breaks live)

**If a button does nothing:**
> "Looks like a wiring issue under the hood — let me show you the architecture anyway via the file structure." → Open `electron/main.ts` in VS Code, narrate the IPC handlers.

**If the window crashes:**
> "Let me restart — this is exactly why the single-instance lock matters." → Double-click `run-demo.bat` again, the app comes back up with the persistent session intact, you continue from where you crashed.

**If Python service is down (red health dot):**
> "The sidecar's down — give me one second." → Open the Python terminal, hit Up + Enter to relaunch. Continue.

**If everything goes catastrophically wrong:**
> "Rather than fight the live demo, let me show you the recorded version — same flow, captured this morning." → Switch to backup video.

---

## Post-demo cleanup

- [ ] Stop `pnpm dev` / `run-demo.bat`.
- [ ] Kill the Python process (`taskkill /IM python.exe`).
- [ ] Re-enable Windows Defender + Windows Update.
- [ ] Save the audit log: copy the SQLite file (or `electron-store` JSON) to a backup folder labeled with the demo date for the thesis defense write-up.
- [ ] Note which Q&A questions came up that weren't on the pre-baked list — add them for the next demo.
