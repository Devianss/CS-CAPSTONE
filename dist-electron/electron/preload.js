"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * preload.ts
 *
 * Runs in the renderer context but with access to Node/Electron APIs.
 * Exposes a typed, safe API surface via contextBridge so the React app
 * never touches raw IPC or Node directly.
 */
const electron_1 = require("electron");
// ─────────────────────────────────────────────
//  Exposed API — window.electronAPI
// ─────────────────────────────────────────────
const api = {
    // Session
    session: {
        get: () => electron_1.ipcRenderer.invoke("session:get"),
        set: (payload) => electron_1.ipcRenderer.invoke("session:set", payload),
        clear: () => electron_1.ipcRenderer.invoke("session:clear"),
    },
    // Settings
    settings: {
        get: () => electron_1.ipcRenderer.invoke("settings:get"),
        set: (partial) => electron_1.ipcRenderer.invoke("settings:set", partial),
    },
    // Window controls (custom titlebar)
    window: {
        minimize: () => electron_1.ipcRenderer.invoke("window:minimize"),
        maximize: () => electron_1.ipcRenderer.invoke("window:maximize"),
        close: () => electron_1.ipcRenderer.invoke("window:close"),
    },
    // Python microservice
    python: {
        call: (endpoint, payload) => electron_1.ipcRenderer.invoke("python:call", endpoint, payload),
    },
    // File dialog
    dialog: {
        openFile: (filters) => electron_1.ipcRenderer.invoke("dialog:openFile", filters),
    },
    // Tray notifications
    tray: {
        notify: (title, body) => {
            electron_1.ipcRenderer.invoke("tray:notify", title, body);
        },
    },
    // App info
    app: {
        version: () => electron_1.ipcRenderer.invoke("app:version"),
        platform: () => electron_1.ipcRenderer.invoke("app:platform"),
    },
    // Listen for main → renderer events (e.g., navigate, notifications)
    on: (channel, listener) => {
        const validChannels = ["navigate", "notification:push", "usb:event"];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, (_event, ...args) => listener(...args));
        }
    },
    off: (channel, listener) => {
        electron_1.ipcRenderer.removeListener(channel, listener);
    },
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", api);
// TypeScript declaration merged in src/types/electron.d.ts
