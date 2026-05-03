import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Shield,
  Settings,
  Wifi,
  Code2,
  Globe,
  Monitor,
  FolderOpen,
  User,
  Volume2,
  Bot,
} from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";
import {
  VSCodeWindow,
  IntelliJWindow,
  ChromeWindow,
  TerminalWindow,
  ProjectsWindow,
} from "./AppWindows";
import {
  NotificationBell,
  NotificationPanel,
  ToastContainer,
  useNotifications,
} from "./NotificationPanel";
import { ProductivityAssistant } from "./agentic/ProductivityAssistant";
import { useElectron } from "../ipc/useElectron";
import { findDemoUser } from "../auth/demoUsers";

const MONO = "'Share Tech Mono', monospace";
const GROTESK = "'Exo 2', sans-serif";
const BRAND = "'Orbitron', sans-serif";

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type AppItem = { id: string; label: string; icon: React.ReactNode };

const apps: AppItem[] = [
  { id: "assistant", label: "ASSISTANT", icon: <Bot size={22} /> },
  { id: "vscode",    label: "VS CODE",  icon: <Code2 size={22} /> },
  {
    id: "intellij",
    label: "INTELLIJ",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <line x1="7" y1="8" x2="11" y2="8" />
        <line x1="7" y1="12" x2="13" y2="12" />
      </svg>
    ),
  },
  { id: "chrome",   label: "CHROME",   icon: <Globe size={22} className="text-[#e8821a]" /> },
  { id: "terminal", label: "TERMINAL", icon: <Monitor size={22} /> },
  { id: "projects", label: "PROJECTS", icon: <FolderOpen size={22} /> },
];

function AppContent({ activeApp, studentId }: { activeApp: string; studentId: string }) {
  switch (activeApp) {
    case "assistant":
      return (
        <div className="h-full min-h-0 p-4 box-border">
          <ProductivityAssistant role="student" userId={studentId} height="100%" />
        </div>
      );
    case "vscode":    return <VSCodeWindow />;
    case "intellij":  return <IntelliJWindow />;
    case "chrome":    return <ChromeWindow />;
    case "terminal":  return <TerminalWindow />;
    case "projects":
    default:          return <ProjectsWindow />;
  }
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const api = useElectron();
  const [secondsUsed, setSecondsUsed] = useState(0);
  const [activeApp, setActiveApp] = useState("vscode");
  const [studentId, setStudentId] = useState("");
  const [studentDisplayName, setStudentDisplayName] = useState("Student");
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    notifications, toast, showPanel, setShowPanel,
    markRead, markAllRead, dismiss, clearAll, dismissToast,
  } = useNotifications();

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUsed((s) => s + 1);
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await api.session.get();
      if (s?.userId) {
        setStudentId(s.userId);
        const u = findDemoUser(s.userId);
        setStudentDisplayName(u?.displayName ?? s.userId);
      }
    })();
  }, [api]);

  const handleLogout = async () => {
    await api.session.clear();
    navigate("/");
  };

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <ToastContainer toast={toast} onDismiss={dismissToast} />

      {/* ── TOP NAVBAR ── */}
      <header
        className="flex items-center justify-between px-5 h-14 border-b border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
        <div className="flex items-center gap-5">
          <span className="text-[#7eb5f5]" style={{ fontSize: "16px", fontFamily: BRAND, letterSpacing: "0.12em" }}>
            RUNA
          </span>
          <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>·</span>
          <span className="text-[#c5d5ea]" style={{ fontSize: "10px", fontFamily: MONO, letterSpacing: "0.15em" }}>SENTINEL</span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-sm border border-[#2a3a55]" style={{ background: "#1a2640" }}>
            <Shield size={11} className="text-[#4a6fa5]" />
            <span className="tracking-widest uppercase text-[#4a6fa5]" style={{ fontSize: "9px", fontFamily: MONO }}>
              Student Session
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Duration of Use */}
          <div className="text-right">
            <div className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
              Elapsed Time
            </div>
            <div className="text-[#c5d5ea] tabular-nums" style={{ fontSize: "20px", fontFamily: MONO, lineHeight: 1.1 }}>
              {formatTime(secondsUsed)}
            </div>
          </div>

          {/* Terminal ID */}
          <div
            className="relative flex items-center gap-2 border border-[#1e2e48] rounded-sm px-3 py-1.5"
            style={{ background: "#111d30" }}
          >
            <div>
              <div className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
                Terminal ID
              </div>
              <div className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>
                {studentId || "—"}
              </div>
            </div>
            <button
              className="w-8 h-8 rounded-sm bg-[#3a5a9a] flex items-center justify-center hover:bg-[#4a6ab5] transition-colors"
              onClick={() => setShowUserMenu((v) => !v)}
              title="User menu"
            >
              <User size={16} className="text-[#c5d5ea]" />
            </button>
            {showUserMenu && (
              <div
                className="absolute top-full right-0 mt-2 rounded-sm border border-[#2a3a55] overflow-hidden z-50"
                style={{ background: "#111d30", minWidth: "160px" }}
              >
                <div className="px-4 py-3 border-b border-[#1a2640]">
                  <p className="text-[#c5d5ea]" style={{ fontSize: "11px" }}>{studentDisplayName}</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>{studentId}</p>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#e05c6a] hover:bg-[#1e2e48] transition-colors"
                  style={{ fontSize: "11px", fontFamily: MONO }}
                  onClick={handleLogout}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <NotificationBell notifications={notifications} onOpen={() => setShowPanel((v) => !v)} />
            {showPanel && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setShowPanel(false)}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
                onDismiss={dismiss}
                onClearAll={clearAll}
              />
            )}
          </div>

          {/* Settings */}
          <button
            className="w-8 h-8 flex items-center justify-center text-[#4a6080] hover:text-[#7eb5f5] transition-colors"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="h-[1px] bg-[#1a2640]" />

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── LEFT SIDEBAR — App icons ── */}
        <aside
          className="flex flex-col items-center pt-4 pb-3 gap-1 border-r border-[#1a2640] shrink-0"
          style={{ width: "72px", background: "#0a1120" }}
        >
          {apps.map((app) => {
            const isActive = activeApp === app.id;
            return (
              <button
                key={app.id}
                onClick={() => setActiveApp(app.id)}
                className="flex flex-col items-center gap-1.5 py-3 w-full transition-all"
                style={{
                  background: isActive ? "#162035" : "transparent",
                  borderLeft: isActive ? "2px solid #3a6fff" : "2px solid transparent",
                  color: isActive ? "#7eb5f5" : "#3a5070",
                }}
                title={app.label}
              >
                {app.icon}
                <span className="tracking-widest" style={{ fontSize: "7px", fontFamily: MONO }}>
                  {app.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* ── CENTER CONTENT ── */}
        <main className="flex-1 min-h-0 overflow-y-auto relative">
          <AppContent activeApp={activeApp} studentId={studentId || "student@runa.edu.ph"} />
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside
          className="flex flex-col border-l border-[#1a2640] shrink-0 py-5 px-4 gap-6"
          style={{ width: "215px", background: "#0a1120" }}
        >
          {/* Station Performance */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
                Station Performance
              </span>
              <div className="w-2 h-2 rounded-full bg-[#3a6fff]" />
            </div>
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>CPU Load</span>
                <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>12%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                <div className="h-full rounded-full" style={{ width: "12%", background: "#3a6fff" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>Memory Usage</span>
                <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>4.2 / 16 GB</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                <div className="h-full rounded-full" style={{ width: "26%", background: "#3a6fff" }} />
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Connection Status */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Connection Status
            </span>
            <div className="flex items-center gap-2 text-[#c5d5ea]">
              <Wifi size={14} className="text-[#4a6fa5]" />
              <span style={{ fontSize: "11px", fontFamily: MONO }}>RUNA-GUEST-SECURE</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ac77e]" />
              <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>Connected · WPA3</span>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Active App */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Active Application
            </span>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#2a3a55]"
              style={{ background: "#162035" }}
            >
              <div className="w-2 h-2 rounded-full bg-[#4ac77e]" />
              <span className="text-[#7eb5f5] tracking-widest uppercase" style={{ fontSize: "10px", fontFamily: MONO }}>
                {apps.find((a) => a.id === activeApp)?.label ?? "VS CODE"}
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Student badge */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Access Level
            </span>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-[#4a6080]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>STUDENT</span>
            </div>
            <p className="text-[#2a3a55] mt-1" style={{ fontSize: "9px", fontFamily: MONO }}>
              Standard lab privileges
            </p>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM TASKBAR ── */}
      <footer
        className="flex items-center justify-between px-5 h-11 border-t border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
        <div className="flex items-center gap-1">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => setActiveApp(app.id)}
              className="relative flex flex-col items-center px-3 pb-1 pt-0.5 transition-colors"
              style={{ color: activeApp === app.id ? "#7eb5f5" : "#4a6080" }}
              title={app.label}
            >
              <span style={{ display: "flex", transform: "scale(0.72)", transformOrigin: "center" }}>
                {app.icon}
              </span>
              {activeApp === app.id && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full"
                  style={{ background: "#3a6fff" }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
            <Monitor size={11} />
            <span className="tracking-widest uppercase">UNIT-04</span>
          </div>
          <button
            className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Volume2 size={14} />
          </button>
          <div className="text-[#4a6080] text-right tabular-nums" style={{ fontSize: "10px", fontFamily: MONO }}>
            <div>{timeStr}</div>
            <div style={{ fontSize: "9px" }}>{dateStr}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}