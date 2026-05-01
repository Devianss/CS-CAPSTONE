"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const electron_store_1 = __importDefault(require("electron-store"));
const fs_1 = __importDefault(require("fs"));
// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development";
const PYTHON_PORT = 5001;
const VITE_DEV_SERVER_URL = "http://localhost:5173";
// Optional brand icon. If the asset is missing we silently fall back
// to Electron's default icon and skip the system tray (acceptable per
// sprint/decision-tree.md §8 — tray is a Day-1 nice-to-have).
const ICON_PATH = path_1.default.join(__dirname, "..", "src", "imports", "image.png");
const HAS_ICON = fs_1.default.existsSync(ICON_PATH);
// ─────────────────────────────────────────────
//  Persistent store (electron-store)
// ─────────────────────────────────────────────
const store = new electron_store_1.default({
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
let mainWindow = null;
let tray = null;
let pythonProcess = null;
// ─────────────────────────────────────────────
//  Python microservice launcher
// ─────────────────────────────────────────────
function startPythonService() {
    const isPacked = electron_1.app.isPackaged;
    // In production the service is a bundled .exe / binary next to the app
    const servicePath = isPacked
        ? path_1.default.join(process.resourcesPath, "python-service", "service.exe")
        : path_1.default.join(__dirname, "..", "python-service", "service.py");
    const cmd = isPacked ? servicePath : "python";
    const args = isPacked ? [] : [servicePath];
    console.log(`[main] Starting Python service: ${cmd} ${args.join(" ")}`);
    pythonProcess = (0, child_process_1.spawn)(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FLASK_PORT: String(PYTHON_PORT) },
    });
    pythonProcess.stdout?.on("data", (d) => console.log("[python]", d.toString().trim()));
    pythonProcess.stderr?.on("data", (d) => console.error("[python:err]", d.toString().trim()));
    pythonProcess.on("exit", (code) => console.warn(`[main] Python service exited with code ${code}`));
}
function stopPythonService() {
    if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill();
        pythonProcess = null;
    }
}
// ─────────────────────────────────────────────
//  Main window factory
// ─────────────────────────────────────────────
function createMainWindow() {
    const session = store.get("session");
    const settings = store.get("settings");
    const win = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        ...(HAS_ICON ? { icon: ICON_PATH } : {}),
    });
    // Load the app
    if (IS_DEV) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools({ mode: "detach" });
    }
    else {
        win.loadFile(path_1.default.join(__dirname, "..", "dist", "index.html"));
    }
    // Intercept navigation – prevent leaving the app in kiosk mode
    win.webContents.on("will-navigate", (event, url) => {
        const allowed = IS_DEV
            ? url.startsWith(VITE_DEV_SERVER_URL)
            : url.startsWith("file://");
        if (!allowed) {
            event.preventDefault();
            electron_1.shell.openExternal(url); // Open external links in the OS browser
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
function createTray() {
    if (!HAS_ICON) {
        console.warn(`[main] Tray icon not found at ${ICON_PATH} — skipping tray creation. ` +
            `Add a 16x16 PNG to enable the tray (see sprint/daily-checklist.md Day 4).`);
        return null;
    }
    const icon = electron_1.nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
    const t = new electron_1.Tray(icon);
    const menu = electron_1.Menu.buildFromTemplate([
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
            click: () => electron_1.app.quit(),
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
function registerIpcHandlers() {
    // ── Session management ──────────────────────
    electron_1.ipcMain.handle("session:get", () => store.get("session"));
    electron_1.ipcMain.handle("session:set", (_event, session) => {
        store.set("session", session);
        return true;
    });
    electron_1.ipcMain.handle("session:clear", () => {
        store.set("session", null);
        return true;
    });
    // ── Settings ────────────────────────────────
    electron_1.ipcMain.handle("settings:get", () => store.get("settings"));
    electron_1.ipcMain.handle("settings:set", (_event, partial) => {
        const current = store.get("settings");
        const updated = { ...current, ...partial };
        store.set("settings", updated);
        // Apply kiosk mode at runtime
        if ("kioskMode" in partial) {
            mainWindow?.setKiosk(partial.kioskMode);
        }
        return updated;
    });
    // ── Window controls ─────────────────────────
    electron_1.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
    electron_1.ipcMain.handle("window:maximize", () => {
        if (mainWindow?.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow?.maximize();
    });
    electron_1.ipcMain.handle("window:close", () => mainWindow?.close());
    // ── Python microservice proxy ────────────────
    electron_1.ipcMain.handle("python:call", async (_event, endpoint, payload) => {
        const { default: axios } = await Promise.resolve().then(() => __importStar(require("axios")));
        try {
            const res = await axios.post(`http://localhost:${PYTHON_PORT}${endpoint}`, payload, { timeout: 15_000 });
            return { ok: true, data: res.data };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Python service error";
            return { ok: false, error: message };
        }
    });
    // ── File dialog ─────────────────────────────
    electron_1.ipcMain.handle("dialog:openFile", async (_event, filters) => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
        });
        return result.canceled ? null : result.filePaths[0];
    });
    // ── Notifications ───────────────────────────
    electron_1.ipcMain.handle("tray:notify", (_event, title, body) => {
        tray?.displayBalloon({ title, content: body });
    });
    // ── App info ────────────────────────────────
    electron_1.ipcMain.handle("app:version", () => electron_1.app.getVersion());
    electron_1.ipcMain.handle("app:platform", () => process.platform);
}
// ─────────────────────────────────────────────
//  App lifecycle
// ─────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    registerIpcHandlers();
    // startPythonService();  // Re-enabled on Day 3 of the demo sprint
    mainWindow = createMainWindow();
    tray = createTray();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    // On macOS keep the process alive; on Windows/Linux quit
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("before-quit", () => {
    stopPythonService();
});
// Prevent multiple app instances
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
