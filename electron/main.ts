import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
} from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import electronStore from "electron-store";
import fs from "fs";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface StoreSchema {
  session: {
    userId: string;
    role: "student" | "admin";
    token: string;
    persistent: boolean;
    expiresAt: number;
  } | null;
  settings: {
    kioskMode: boolean;
    theme: "dark" | "light";
    notifications: boolean;
  };
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development";
const PYTHON_PORT = 5001;
const VITE_DEV_SERVER_URL = "http://localhost:5173";

// ─────────────────────────────────────────────
//  Persistent store (electron-store)
// ─────────────────────────────────────────────
const store = new electronStore<StoreSchema>({
  defaults: {
    session: null,
    settings: {
      kioskMode: false,
      theme: "dark",
      notifications: true,
    },
  },
});

// ─────────────────────────────────────────────
//  Globals
// ─────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pythonProcess: ChildProcess | null = null;

// ─────────────────────────────────────────────
//  Python microservice launcher
// ─────────────────────────────────────────────
function startPythonService(): void {
  const isPacked = app.isPackaged;

  // In production the service is a bundled .exe / binary next to the app
  const servicePath = isPacked
    ? path.join(process.resourcesPath, "python-service", "service.exe")
    : path.join(__dirname, "..", "python-service", "service.py");

  const cmd = isPacked ? servicePath : "python";
  const args = isPacked ? [] : [servicePath];

  console.log(`[main] Starting Python service: ${cmd} ${args.join(" ")}`);

  pythonProcess = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FLASK_PORT: String(PYTHON_PORT) },
  });

  pythonProcess.stdout?.on("data", (d) =>
    console.log("[python]", d.toString().trim())
  );
  pythonProcess.stderr?.on("data", (d) =>
    console.error("[python:err]", d.toString().trim())
  );
  pythonProcess.on("exit", (code) =>
    console.warn(`[main] Python service exited with code ${code}`)
  );
}

function stopPythonService(): void {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// ─────────────────────────────────────────────
//  Main window factory
// ─────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const session = store.get("session");
  const settings = store.get("settings");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: "PCU Lab Portal",
    backgroundColor: "#0d1320",
    // Hide the default frame so we can use a custom titlebar
    frame: false,
    titleBarStyle: "hidden",
    kiosk: settings.kioskMode,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, "..", "src", "imports", "image.png"),
  });

  // Load the app
  if (IS_DEV) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Intercept navigation – prevent leaving the app in kiosk mode
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = IS_DEV
      ? url.startsWith(VITE_DEV_SERVER_URL)
      : url.startsWith("file://");
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url); // Open external links in the OS browser
    }
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

// ─────────────────────────────────────────────
//  System tray
// ─────────────────────────────────────────────
function createTray(): Tray {
  const iconPath = path.join(__dirname, "..", "src", "imports", "image.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const t = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: "PCU Lab Portal", enabled: false },
    { type: "separator" },
    {
      label: "Show Window",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Settings",
      click: () => {
        mainWindow?.webContents.send("navigate", "/settings");
        mainWindow?.show();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  t.setToolTip("PCU Lab Portal");
  t.setContextMenu(menu);
  t.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  return t;
}

// ─────────────────────────────────────────────
//  IPC handlers
// ─────────────────────────────────────────────
function registerIpcHandlers(): void {
  // ── Session management ──────────────────────
  ipcMain.handle("session:get", () => store.get("session"));

  ipcMain.handle("session:set", (_event, session: StoreSchema["session"]) => {
    store.set("session", session);
    return true;
  });

  ipcMain.handle("session:clear", () => {
    store.set("session", null);
    return true;
  });

  // ── Settings ────────────────────────────────
  ipcMain.handle("settings:get", () => store.get("settings"));

  ipcMain.handle(
    "settings:set",
    (_event, partial: Partial<StoreSchema["settings"]>) => {
      const current = store.get("settings");
      const updated = { ...current, ...partial };
      store.set("settings", updated);

      // Apply kiosk mode at runtime
      if ("kioskMode" in partial) {
        mainWindow?.setKiosk(partial.kioskMode!);
      }
      return updated;
    }
  );

  // ── Window controls ─────────────────────────
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());

  // ── Python microservice proxy ────────────────
  ipcMain.handle(
    "python:call",
    async (_event, endpoint: string, payload: unknown) => {
      const { default: axios } = await import("axios");
      try {
        const res = await axios.post(
          `http://localhost:${PYTHON_PORT}${endpoint}`,
          payload,
          { timeout: 15_000 }
        );
        return { ok: true, data: res.data };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Python service error";
        return { ok: false, error: message };
      }
    }
  );

  // ── File dialog ─────────────────────────────
  ipcMain.handle("dialog:openFile", async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Notifications ───────────────────────────
  ipcMain.handle("tray:notify", (_event, title: string, body: string) => {
    tray?.displayBalloon({ title, content: body });
  });

  // ── App info ────────────────────────────────
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:platform", () => process.platform);
}

// ─────────────────────────────────────────────
//  App lifecycle
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  registerIpcHandlers();
  startPythonService();
  mainWindow = createMainWindow();
  tray = createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS keep the process alive; on Windows/Linux quit
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopPythonService();
});

// Prevent multiple app instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
