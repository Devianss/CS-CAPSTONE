# PCU Lab Portal – Desktop Application

Electron + React + TypeScript desktop shell for the PCU Lab Portal,
as described in the Agentic RPA thesis tech stack.

---

## Architecture

```
pcu-lab-portal/
├── electron/           ← Electron MAIN process (Node.js)
│   ├── main.ts         – Window creation, tray, IPC handlers, Python launcher
│   ├── preload.ts      – Safe contextBridge API exposed to renderer
│   └── db.ts           – better-sqlite3 schema + helpers
│
├── python-service/
│   └── service.py      – Flask microservice: ClamAV, USB, Groq AI
│
├── src/
│   ├── app/
│   │   ├── App.tsx                     – Root layout (TitleBar + Router)
│   │   ├── routes.ts                   – React Router config
│   │   ├── components/
│   │   │   ├── TitleBar.tsx            – Custom frameless window chrome
│   │   │   ├── LoginPage.tsx           – (unchanged from zip)
│   │   │   ├── Dashboard.tsx           – (unchanged)
│   │   │   └── ...                     – all other existing components
│   │   └── ipc/
│   │       └── useElectron.ts          – React hooks for window.electronAPI
│   └── types/
│       └── electron.d.ts               – Global TypeScript types for the API
│
├── vite.config.ts          – Renderer build (base: "./")
├── tsconfig.json           – Renderer TypeScript
├── tsconfig.electron.json  – Main/preload TypeScript (CommonJS)
└── package.json            – All deps + electron-builder config
```

---

## Prerequisites

- **Node.js v22+** (bundled in Electron, but needed for build tools)
- **pnpm** (or npm/yarn – update scripts accordingly)
- **Python 3.12** with pip
- **ClamAV** installed (optional for dev; required for production)

---

## Setup

### 1. Install Node dependencies

```bash
pnpm install
# or: npm install
```

### 2. Install Python dependencies

```bash
cd python-service
pip install flask groq boto3 python-clamd watchdog requests pyusb
# For Windows USB scanning:
# pip install pywinusb
```

### 3. Configure AI provider credentials

```bash
# Option A – python-service/.env
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

# Option B – Environment variables
export AI_PROVIDER=groq
export GROQ_API_KEY=...
export GROQ_MODEL=llama-3.3-70b-versatile
```

---

## Development

```bash
# Terminal 1 – Vite dev server (renderer)
pnpm dev:vite

# Terminal 2 – Wait for Vite then launch Electron
pnpm electron-wait-vite

# Or use the combined command (requires concurrently):
pnpm dev
```

The app opens in a frameless Electron window pointing at `http://localhost:5173`.
Hot-reload works for React components; changes to `electron/main.ts` require
restarting Electron.

---

## Production Build

```bash
# 1. Bundle Python service to a standalone exe (Windows)
cd python-service
pip install pyinstaller
pyinstaller --onefile service.py
# Output: python-service/dist/service.exe

# 2. Build renderer + compile Electron main/preload
pnpm build

# 3. Package into installer
pnpm build:win
# Output: release/PCU Lab Portal Setup x.x.x.exe
```

---

## IPC API Reference

All renderer ↔ main communication goes through `window.electronAPI`.

```typescript
// Session
await window.electronAPI.session.get()          // → ElectronSession | null
await window.electronAPI.session.set(payload)   // → boolean
await window.electronAPI.session.clear()        // → boolean

// Settings
await window.electronAPI.settings.get()         // → ElectronSettings
await window.electronAPI.settings.set({ kioskMode: true })

// Window controls
window.electronAPI.window.minimize()
window.electronAPI.window.maximize()
window.electronAPI.window.close()

// Python microservice
await window.electronAPI.python.call('/scan-file', { path: 'C:/...' })
await window.electronAPI.python.call('/ai-task', { prompt: 'Summarize sessions' })
await window.electronAPI.python.call('/scan-usb')

// File dialog
const filePath = await window.electronAPI.dialog.openFile()

// Tray notification
window.electronAPI.tray.notify('Alert', 'Suspicious USB detected')
```

Use the `useElectron()` hook in React components for full TypeScript support:

```tsx
import { useElectron, usePython } from '@/app/ipc/useElectron'

function MyComponent() {
  const { session, window: win } = useElectron()
  const { call } = usePython()

  const logout = async () => {
    await session.clear()
    win.close()
  }

  const scanFile = async (path: string) => {
    const result = await call('/scan-file', { path })
    if (!result.ok || !result.data?.clean) {
      alert('Threat detected!')
    }
  }
}
```

---

## Python Service Endpoints

| Endpoint       | Method | Payload              | Returns                       |
|----------------|--------|----------------------|-------------------------------|
| `/health`      | GET    | —                    | `{ status, clamd, usb }`      |
| `/scan-file`   | POST   | `{ path }`           | `{ clean, threat, sha256 }`   |
| `/scan-usb`    | POST   | —                    | `{ devices[], count }`        |
| `/analyze-url` | POST   | `{ url }`            | `{ suspicious, score }`       |
| `/ai-task`     | POST   | `{ prompt, system?, role?, tools?, history?, maxTokens?, temperature? }` | `{ ok, response, source, model, inputTokens, outputTokens, totalTokens, updatedHistory }`  |

AI provider defaults to **Groq** using `llama-3.3-70b-versatile`. Configure per machine with:

```bash
set AI_PROVIDER=groq
set GROQ_API_KEY=your_key_here
set GROQ_MODEL=llama-3.3-70b-versatile
```

## Groq Setup

### Required API Key
Create a Groq API key and set it as `GROQ_API_KEY` in `python-service/.env`.

### Model Selection
Primary model: `llama-3.3-70b-versatile`.

---

## Thesis Development Timeline Mapping

| Phase | Weeks | Files to work on |
|-------|-------|-----------------|
| Month 1 – Core | 1-4 | `electron/main.ts`, `electron/db.ts`, `LoginPage.tsx`, `TitleBar.tsx` |
| Month 2 – Security | 5-8 | `python-service/service.py` (ClamAV, USB), AWS Cognito in `main.ts` |
| Month 3 – Agentic AI | 9-12 | `/ai-task` endpoint, AI chat UI components, `AppWindows.tsx` |
| Month 4 – Polish | 13-16 | `electron-builder` config, auto-start, QuickSight reports |
