# Decision Trees — Gaps & Risk Mitigation

For every known gap or risk, this file gives you (a) a **decision tree** to determine which path to take, (b) the **fallback plan**, and (c) the **explicit cut** if everything else fails. Consult this **before** spending more than 30 minutes fighting any single problem.

---

## §1 Electron won't boot in dev (Day 1)

```mermaid
flowchart TD
    A[pnpm dev fails or window blank] --> B{Is Vite serving on :5173?}
    B -- No --> B1[Fix Vite first<br/>port conflict? plugin error?]
    B1 --> A
    B -- Yes --> C{Did electron-store import?}
    C -- "ERR: ESM only" --> C1[Downgrade to electron-store@8<br/>pnpm add electron-store@^8]
    C1 --> A
    C -- OK --> D{Did preload.ts compile to dist-electron/?}
    D -- No --> D1[Run pnpm build:electron manually<br/>fix TS errors in electron/*.ts]
    D1 --> A
    D -- Yes --> E{Window opens but blank}
    E -- "Yes, blank" --> E1["Check DevTools console<br/>Likely base path or main.tsx import error"]
    E -- "No, errors" --> E2["Check Electron terminal stderr<br/>Likely native module load failure"]
    E2 --> F{Is it better-sqlite3?}
    F -- Yes --> F1[Defer SQLite → Path B in §2<br/>Comment out db.ts imports for now]
    F -- No --> F2[Read full stderr; if unclear, post in Discord/standup]
```

**Fallback if Day 1 won't pass by EOD:** Drop Electron entirely for the demo and present the React UI as a Chrome web app launched in `--app` mode (`chrome --app=http://localhost:5173`). You lose tray + kiosk + IPC, but you keep the visuals. Document this as a thesis limitation.

---

## §2 better-sqlite3 won't compile (Day 1 / Day 3)

`better-sqlite3` is a native module. It needs a C++ toolchain to build against the Electron headers.

```mermaid
flowchart TD
    A[pnpm add better-sqlite3 fails<br/>or runtime: NODE_MODULE_VERSION mismatch] --> B{Do you have VS Build Tools<br/>+ Python on the dev box?}
    B -- Yes --> C[Run: npx electron-rebuild<br/>or pnpm rebuild:native]
    C --> D{Did it rebuild?}
    D -- Yes --> E[✅ Use Path A — SQLite-backed audit log]
    D -- No --> F[Take Path B fallback]
    B -- No --> G{Can you install VSBT in <30 min?}
    G -- Yes --> G1[Install Build Tools for Visual Studio<br/>+ Python 3.x on PATH<br/>Restart shell, retry C]
    G1 --> C
    G -- No --> F
    F[Path B — electron-store JSON audit log] --> H[Replace db.ts helpers with<br/>electron-store array under key auditLog<br/>Same IPC surface, no schema migration]
    H --> I[✅ Audit-log persistence works,<br/>just no SQL queries]
```

**Decision rule:** If you're past 90 min total on `better-sqlite3`, **switch to Path B**. Don't sink Day 1 or Day 3 over a storage detail the panelists won't ask about.

---

## §3 Python service won't spawn (Day 3)

```mermaid
flowchart TD
    A[Electron starts but Python<br/>doesn't print on stdout] --> B{Does python --version<br/>work in your shell?}
    B -- No --> B1["Switch spawn cmd to 'py' (Windows)<br/>or absolute path to python.exe"]
    B1 --> A
    B -- Yes --> C{Does python service.py work<br/>when run manually?}
    C -- No --> C1[Fix Python deps:<br/>pip install flask boto3 ...<br/>read traceback]
    C1 --> C
    C -- Yes --> D{Does port 5001 collide<br/>with another service?}
    D -- Yes --> D1[Change FLASK_PORT in main.ts<br/>and python-service env]
    D -- No --> E{Is anti-virus blocking<br/>child processes?}
    E -- Yes --> E1[Add repo folder to AV exclusion<br/>or run service manually for demo]
    E -- No --> F[Spawn it in a separate terminal:<br/>'python python-service\service.py'<br/>and demo as if it were embedded]
```

**Demo-day fallback:** Run `python python-service\service.py` in a **separate Windows Terminal** before launching the Electron app. The IPC `python:call` handler hits `localhost:5001` either way — the user can't tell the difference.

---

## §4 ClamAV / pyusb not installed (Day 3)

The Python service is **already designed to gracefully stub** when these libs are missing — see `python-service/service.py` lines 36–47.

```mermaid
flowchart TD
    A[/scan-file or /scan-usb returns<br/>ok=true but stub data/] --> B{Demo needs realism?}
    B -- "Audience is technical thesis panel" --> C[Show the stub response<br/>Explicitly narrate: 'In production this calls ClamAV;<br/>for demo we return SHA-256 hash + clean=true']
    B -- "Audience expects malware demo" --> D{Time + permissions to install ClamAV?}
    D -- Yes --> D1[Install ClamAV daemon, point clamd at it,<br/>scan an EICAR test file → real 'Eicar-Test-Signature' threat]
    D -- No --> C
    C --> E[✅ Acceptable — the IPC + Flask round-trip<br/>is the real artifact, not the AV engine]
```

**Pro tip:** If ClamAV IS installed, drop a `eicar.com` test file (the standard harmless AV test signature) on the desktop and scan that during the demo for a real "threat detected" toast.

---

## §5 Groq / `/ai-task` doesn't have API key (Day 4 / Day 5)

`/ai-task` is expected for the defense run. If provider auth fails on the day, keep the endpoint live and fall back to clearly-labeled local responses (do not cut the assistant flow).

```mermaid
flowchart TD
    A[POST /ai-task fails<br/>auth/network/provider error] --> B{Is GROQ_API_KEY set<br/>in python-service/.env?}
    B -- No --> C[Keep /ai-task route active but return<br/>clearly-labeled local fallback response]
    B -- Yes --> D{Is AI_PROVIDER='groq'<br/>and model valid?}
    D -- No --> D1["Set AI_PROVIDER=groq<br/>and GROQ_MODEL=llama-3.3-70b-versatile"]
    D1 --> E
    D -- Yes --> E[Test with curl directly to Flask:<br/>curl -XPOST localhost:5001/ai-task<br/>-d '{prompt:hello}']
    E --> G{200 response?}
    G -- Yes --> H[✅ Wire a small chat UI<br/>or canned button into admin console]
    G -- No --> C
```

**Canned-response fallback** (5-minute change): in `service.py` `/ai-task`, return a clearly-labeled local response:
```py
return jsonify(ok=True,
    response=("Today's lab activity summary: 24 students across COMLAB 8, 1 quarantine event "
             "in COMLAB 8 PC-01 (kill_linux_skills.exe). All security protocols nominal."),
    input_tokens=0)
```
In defense narration, explicitly state this is a fallback response because Groq credentials were unavailable on that machine.

---

## §6 Native rebuild fails for `electron-builder` (Day 5)

```mermaid
flowchart TD
    A[pnpm build:win fails<br/>at app-builder step] --> B{Is it a code-signing error?}
    B -- Yes --> B1["Add { 'win': { 'signAndEditExecutable': false } } to build config"]
    B1 --> A
    B -- No --> C{Is it native module rebuild?}
    C -- Yes --> C1[Run: pnpm rebuild:native<br/>then pnpm build:win again]
    C1 --> D{Pass?}
    D -- Yes --> E[✅ Ship portable .exe]
    D -- No --> F[Drop SQLite native dep, switch<br/>to electron-store path §2 Path B,<br/>retry build]
    F --> G{Pass now?}
    G -- Yes --> E
    G -- No --> H[**Cut packaged build entirely**<br/>Ship run-demo.bat as the launcher]
    C -- No --> I[Read full electron-builder log<br/>If unclear: ship dev launcher]
    I --> H
```

**The `run-demo.bat` launcher is just as legitimate as a packaged `.exe` for a thesis demo.** Don't burn Day 5 morning fighting `electron-builder`.

---

## §7 Demo machine misbehaves (Day 5 / Demo day)

```mermaid
flowchart TD
    A[Issue on demo laptop] --> B{What kind?}
    B -- "Antivirus blocks .exe" --> B1[Right-click → Run anyway<br/>OR fall back to run-demo.bat]
    B -- "Vite port 5173 in use" --> B2[Edit vite.config.mjs port<br/>+ VITE_DEV_SERVER_URL in main.ts<br/>Or kill the offending process]
    B -- "No Python on laptop" --> B3[Either install Python 3.12 in <10min<br/>OR cut Python-dependent demo steps<br/>OR pre-record that segment]
    B -- "Display scaling makes UI broken" --> B4[Open SettingsPanel → set zoom 100%<br/>OR run with --force-device-scale-factor=1]
    B -- "Network restricted, /health fails" --> B5[Service is local — should still work.<br/>If firewall blocks loopback,<br/>check Windows Firewall Allow apps]
    B -- "Live demo crashes mid-flow" --> C[Switch to backup recording<br/>Acknowledge briefly, keep talking]
```

**Day-of demo non-negotiables:**
1. Reboot 1 hour before. Do nothing else on the laptop.
2. Disable Windows Update + Defender real-time scan during demo.
3. Have backup video pre-loaded in second monitor / Alt-Tab spot.
4. Have charger plugged in.
5. Have a pre-warmed `pnpm dev` already running before the panel sits down.

---

## §8 Scope-cut decision matrix

If by **end of Day N** you don't have **enough**, here's what to drop, in order:

| Day | If you're behind, drop … | Reason it's safe to drop |
|---|---|---|
| 1 | Tray icon (use Electron default) | Cosmetic; demo still works |
| 1 | Single-instance lock | Nice-to-have; demo doesn't open twice |
| 2 | Tray Logout menu item | Dropdown logout still works |
| 2 | Persistent session checkbox semantics | All sessions persistent by default |
| 3 | SQLite path → fallback to electron-store JSON | Same UX, simpler infra |
| 3 | `/scan-usb` (just keep `/scan-file`) | One real action is enough |
| 3 | Health badge | Demo audience won't notice |
| 4 | Lock Cluster persistence (just toggle UI state) | Audit log is the persistence proof |
| 4 | Kiosk mode toggle | Frameless window already feels kiosk-y |
| 4 | Tray notifications | Toasts cover the same UX |
| 5 | Packaged `.exe` (use dev launcher) | Already in §6 |
| 5 | `/ai-task` Groq | Already cut by default |

**Last-resort minimum viable demo (~2.5 days of work):**
- Electron window opens with React UI.
- Hardcoded login routes admin vs student.
- One mock alert in the dashboard.
- One real button that calls Python `/scan-file` and shows a toast.
- Logout works.

That's it. Even this is enough to prove the architecture is real.

---

## §9 Time-box rules (apply to every step)

Before going into a hole on any single bug, set a 30-min timer. When it rings:

```mermaid
flowchart TD
    A[30-min timer rings] --> B{Did I make<br/>measurable progress?}
    B -- Yes --> C[Reset timer, continue]
    B -- No --> D{Is there a fallback<br/>in this file?}
    D -- Yes --> E[Switch to fallback NOW]
    D -- No --> F{Is this on the<br/>critical path?}
    F -- Yes --> G[Ask for help / pair<br/>OR cut scope per §8]
    F -- No --> H[Skip + document as<br/>known limitation]
```

**The most expensive bug in a 5-day sprint is the one you spent two days on instead of routing around.**
