import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Shield,
  Settings,
  Wifi,
  Monitor,
  User,
  Volume2,
  LayoutDashboard,
  Activity,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";
import {
  NotificationBell,
  NotificationPanel,
  ToastContainer,
  useNotifications,
} from "./NotificationPanel";
import { LabDashboardPanel } from "./LabDashboardPanel";
import { LabMonitoringPanel } from "./LabMonitoringPanel";
import { AccessControlPanel } from "./AccessControlPanel";
import { AuditTrailsPanel } from "./AuditTrailsPanel";

const MONO = "'Share Tech Mono', monospace";
const GROTESK = "'Exo 2', sans-serif";
const BRAND = "'Orbitron', sans-serif";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { id: "lab-dashboard",  label: "DASHBOARD",  icon: <LayoutDashboard size={20} /> },
  { id: "lab-monitoring", label: "MONITORING", icon: <Activity size={20} /> },
  { id: "access-control", label: "ACCESS",     icon: <ShieldCheck size={20} /> },
  { id: "audit-trails",   label: "AUDIT",      icon: <FileText size={20} /> },
];

function AdminContent({ active }: { active: string }) {
  switch (active) {
    case "lab-monitoring": return <LabMonitoringPanel />;
    case "access-control": return <AccessControlPanel />;
    case "audit-trails":   return <AuditTrailsPanel />;
    case "lab-dashboard":
    default:               return <LabDashboardPanel />;
  }
}

export function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("lab-dashboard");
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    notifications,
    toast,
    showPanel,
    setShowPanel,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
    dismissToast,
  } = useNotifications();

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  const activeLabel = navItems.find((n) => n.id === activeNav)?.label ?? "DASHBOARD";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      {/* Settings overlay */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Toast */}
      <ToastContainer toast={toast} onDismiss={dismissToast} />

      {/* ── TOP NAVBAR ── */}
      <header
        className="flex items-center justify-between px-5 h-14 border-b border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
        {/* Left: Logo + role badge */}
        <div className="flex items-center gap-5">
          <span className="text-[#7eb5f5]" style={{ fontSize: "16px", fontFamily: BRAND, letterSpacing: "0.12em" }}>
            RUNA
          </span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-sm border border-[#2a3a55]" style={{ background: "#1a2640" }}>
            <Shield size={11} className="text-[#4a6fa5]" />
            <span className="tracking-widest uppercase text-[#4a6fa5]" style={{ fontSize: "9px", fontFamily: MONO }}>
              Admin Session
            </span>
          </div>
        </div>

        {/* Right: Admin ID + Icons */}
        <div className="flex items-center gap-4">
          {/* Admin ID */}
          <div
            className="relative flex items-center gap-2 border border-[#1e2e48] rounded-sm px-3 py-1.5"
            style={{ background: "#111d30" }}
          >
            <div>
              <div className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
                Admin ID
              </div>
              <div className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>
                admin@runa.edu.ph
              </div>
            </div>
            <button
              className="w-8 h-8 rounded-sm bg-[#3a5a9a] flex items-center justify-center hover:bg-[#4a6ab5] transition-colors"
              onClick={() => setShowUserMenu((v) => !v)}
              title="Admin menu"
            >
              <User size={16} className="text-[#c5d5ea]" />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div
                className="absolute top-full right-0 mt-2 rounded-sm border border-[#2a3a55] overflow-hidden z-50"
                style={{ background: "#111d30", minWidth: "160px" }}
              >
                {/* Profile row */}
                <div className="px-4 py-3 border-b border-[#1a2640]">
                  <p className="text-[#c5d5ea]" style={{ fontSize: "11px" }}>System Administrator</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>admin@runa.edu.ph</p>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#e05c6a] hover:bg-[#1e2e48] transition-colors"
                  style={{ fontSize: "11px", fontFamily: MONO }}
                  onClick={() => navigate("/")}
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

      {/* Accent line */}
      <div className="h-[1px] bg-[#1a2640]" />

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR — Admin nav only ── */}
        <aside
          className="flex flex-col items-center pt-4 pb-3 gap-1 border-r border-[#1a2640] shrink-0"
          style={{ width: "88px", background: "#0a1120" }}
        >
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className="flex flex-col items-center gap-1.5 py-3.5 w-full transition-all"
                style={{
                  background: isActive ? "#162035" : "transparent",
                  borderLeft: isActive ? "2px solid #3a6fff" : "2px solid transparent",
                  color: isActive ? "#7eb5f5" : "#3a5070",
                }}
                title={item.label}
              >
                {item.icon}
                <span className="tracking-widest" style={{ fontSize: "7px", fontFamily: MONO }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* ── CENTER CONTENT ── */}
        <main className="flex-1 overflow-y-auto relative">
          <AdminContent active={activeNav} />

          {/* System log notification */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div
              className="flex gap-3 p-4 rounded-sm border border-[#1a2640]"
              style={{ background: "rgba(17,29,48,0.92)", maxWidth: "320px" }}
            >
              <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#3a6fff" }} />
              <div>
                <p className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO, lineHeight: 1.5 }}>
                  Admin Policy: All actions are logged and audited per RUNA security protocol.
                </p>
                <p className="text-[#2e4060] mt-1" style={{ fontSize: "10px", fontFamily: MONO }}>
                  System Log {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside
          className="flex flex-col border-l border-[#1a2640] shrink-0 py-5 px-4 gap-6 overflow-y-auto"
          style={{ width: "215px", background: "#0a1120" }}
        >
          {/* Server Performance */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
                Server Performance
              </span>
              <div className="w-2 h-2 rounded-full bg-[#4ac77e]" />
            </div>
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>CPU Load</span>
                <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>18%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                <div className="h-full rounded-full" style={{ width: "18%", background: "#3a6fff" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>Memory</span>
                <span className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>6.1 / 32 GB</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                <div className="h-full rounded-full" style={{ width: "19%", background: "#3a6fff" }} />
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Connection Status */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Network
            </span>
            <div className="flex items-center gap-2 text-[#c5d5ea]">
              <Wifi size={14} className="text-[#4a6fa5]" />
              <span style={{ fontSize: "11px", fontFamily: MONO }}>RUNA-ADMIN-NET</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ac77e]" />
              <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>Encrypted · TLS 1.3</span>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Active View */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Active View
            </span>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#2a3a55]"
              style={{ background: "#162035" }}
            >
              <div className="w-2 h-2 rounded-full bg-[#3a6fff]" />
              <span className="text-[#7eb5f5] tracking-widest uppercase" style={{ fontSize: "10px", fontFamily: MONO }}>
                {activeLabel}
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-[#1a2640]" />

          {/* Admin Role Badge */}
          <div>
            <span className="block text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Privilege Level
            </span>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-[#4a6fa5]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>SUPER ADMIN</span>
            </div>
            <p className="text-[#2a3a55] mt-1" style={{ fontSize: "9px", fontFamily: MONO }}>
              Full system privileges
            </p>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM TASKBAR ── */}
      <footer
        className="flex items-center justify-between px-5 h-11 border-t border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
        {/* Left: Admin nav dock */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className="relative flex flex-col items-center px-3 pb-1 pt-0.5 transition-colors"
              style={{ color: activeNav === item.id ? "#7eb5f5" : "#4a6080" }}
              title={item.label}
            >
              <span style={{ display: "flex", transform: "scale(0.72)", transformOrigin: "center" }}>
                {item.icon}
              </span>
              {activeNav === item.id && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full"
                  style={{ background: "#3a6fff" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Right: admin tag + volume + time */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
            <Shield size={11} />
            <span className="tracking-widest uppercase">ADMIN</span>
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