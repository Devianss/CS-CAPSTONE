import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Shield,
  Wifi,
  User,
  LayoutGrid,
  Activity,
  ShieldCheck,
  FileText,
  Bot,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { NotificationsMenu } from "../providers/NotificationProvider";
import { AdminCommandCenter } from "./AdminCommandCenter";
import { AdminLabProvider } from "../context/AdminLabContext";
import { LabMonitoringPanel } from "./LabMonitoringPanel";
import { AccessControlPanel } from "./AccessControlPanel";
import { AuditTrailsPanel } from "./AuditTrailsPanel";
import { ProductivityAssistant } from "./agentic/ProductivityAssistant";
import { ApprovalsQueue } from "./agentic/ApprovalsQueue";
import { RiskBadge } from "./agentic/RiskBadge";
import { PythonServiceBadge } from "./PythonServiceBadge";
import { useElectron } from "../ipc/useElectron";
import { findDemoUser } from "../auth/demoUsers";
import { listPending, proposeAction } from "../agentic/approvalQueue";

const MONO = "'Share Tech Mono', monospace";
const GROTESK = "'Exo 2', sans-serif";
const BRAND = "'Orbitron', sans-serif";

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

const navItems = (
  pending: number,
): NavItem[] => [
  { id: "command-center", label: "COMMAND", icon: <LayoutGrid size={20} /> },
  { id: "lab-monitoring", label: "MONITORING", icon: <Activity size={20} /> },
  { id: "access-control", label: "ACCESS", icon: <ShieldCheck size={20} /> },
  { id: "audit-trails", label: "AUDIT", icon: <FileText size={20} /> },
  { id: "assistant", label: "ASSISTANT", icon: <Bot size={20} /> },
  {
    id: "approvals",
    label: "APPROVALS",
    icon: <Inbox size={20} />,
    badge: pending > 0 ? pending : undefined,
  },
];

function AdminContent({
  active,
  adminId,
  onApprovalsChange,
  onNavigate,
  pendingCount,
}: {
  active: string;
  adminId: string;
  onApprovalsChange?: () => void;
  onNavigate: (id: string) => void;
  pendingCount: number;
}) {
  switch (active) {
    case "assistant":
      return (
        <div className="h-full min-h-0 p-4 box-border">
          <ProductivityAssistant role="admin" userId={adminId} height="100%" />
        </div>
      );
    case "approvals":
      return (
        <div className="h-full min-h-0 p-4 box-border">
          <ApprovalsQueue currentAdminId={adminId} onChange={onApprovalsChange} />
        </div>
      );
    case "lab-monitoring":
      return <LabMonitoringPanel />;
    case "access-control":
      return <AccessControlPanel />;
    case "audit-trails":
      return <AuditTrailsPanel />;
    case "command-center":
    default:
      return <AdminCommandCenter onNavigate={onNavigate} pendingCount={pendingCount} />;
  }
}

export function Dashboard() {
  const navigate = useNavigate();
  const api = useElectron();
  const [activeNav, setActiveNav] = useState("command-center");
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminDisplayName, setAdminDisplayName] = useState("System Administrator");
  const [pendingCount, setPendingCount] = useState(0);
  const refreshPending = useCallback(async () => {
    try {
      const p = await listPending();
      setPendingCount(p.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await api.session.get();
      if (s?.userId) {
        setAdminId(s.userId);
        const u = findDemoUser(s.userId);
        setAdminDisplayName(u?.displayName ?? s.userId);
      }
      await refreshPending();
    })();
  }, [api, refreshPending]);

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  const items = navItems(pendingCount);
  const activeLabel = items.find((n) => n.id === activeNav)?.label ?? "DASHBOARD";

  const handleLogout = async () => {
    await api.session.clear();
    navigate("/");
  };

  const triggerHigh = async (type: "wipe_terminal" | "lock_cluster") => {
    if (!adminId) return;
    await proposeAction(
      {
        type,
        scope: "lab",
        reversible: false,
        payload: { source: "dev_trigger" },
        confidence: 0.9,
        reasoning: `Dev-only staging trigger (${type})`,
      },
      adminId,
      "admin",
    );
    await refreshPending();
  };

  return (
    <AdminLabProvider>
    <div className="flex flex-col h-full min-h-0" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      <header
        className="flex items-center justify-between px-5 h-14 border-b border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
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

        <div className="flex items-center gap-4">
          <PythonServiceBadge />
          <div
            className="relative flex items-center gap-2 border border-[#1e2e48] rounded-sm px-3 py-1.5"
            style={{ background: "#111d30" }}
          >
            <div>
              <div className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
                Admin ID
              </div>
              <div className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>
                {adminId || "—"}
              </div>
            </div>
            <button
              className="w-8 h-8 rounded-sm bg-[#3a5a9a] flex items-center justify-center hover:bg-[#4a6ab5] transition-colors"
              onClick={() => setShowUserMenu((v) => !v)}
              title="Admin menu"
            >
              <User size={16} className="text-[#c5d5ea]" />
            </button>

            {showUserMenu && (
              <div
                className="absolute top-full right-0 mt-2 rounded-sm border border-[#2a3a55] overflow-hidden z-[var(--z-popover)]"
                style={{ background: "#111d30", minWidth: "160px" }}
              >
                <div className="px-4 py-3 border-b border-[#1a2640]">
                  <p className="text-[#c5d5ea]" style={{ fontSize: "11px" }}>{adminDisplayName}</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>{adminId}</p>
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

          <NotificationsMenu />

        </div>
      </header>

      <div className="h-[1px] bg-[#1a2640]" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside
          className="flex flex-col items-center pt-4 pb-3 gap-1 border-r border-[#1a2640] shrink-0"
          style={{ width: "88px", background: "#0a1120" }}
        >
          {items.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className="relative flex flex-col items-center gap-1.5 py-3.5 w-full transition-all"
                style={{
                  background: isActive ? "#162035" : "transparent",
                  borderLeft: isActive ? "2px solid #3a6fff" : "2px solid transparent",
                  color: isActive ? "#7eb5f5" : "#3a5070",
                }}
                title={item.label}
              >
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute top-2 right-2 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center text-white"
                    style={{ fontSize: "8px", fontFamily: MONO, background: "#e05c6a" }}
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
                <span className="tracking-widest" style={{ fontSize: "7px", fontFamily: MONO }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
          <div className="flex flex-1 min-h-0 overflow-y-auto">
            <div className="flex-1 min-h-0">
              <AdminContent
                active={activeNav}
                adminId={adminId || "admin@runa.edu.ph"}
                onApprovalsChange={refreshPending}
                onNavigate={setActiveNav}
                pendingCount={pendingCount}
              />
            </div>

            <aside
              className="flex flex-col border-l border-[#1a2640] shrink-0 py-5 px-4 gap-6 overflow-y-auto min-h-0"
              style={{ width: "215px", background: "#0a1120" }}
            >
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

              {import.meta.env.DEV && (
                <>
                  <div className="h-[1px] bg-[#1a2640]" />
                  <div>
                    <span className="block text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>
                      Agentic preview
                    </span>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <RiskBadge tier="low" compact />
                      <RiskBadge tier="medium" compact />
                      <RiskBadge tier="high" compact />
                    </div>
                    <p className="text-[#2a3a55] mb-2" style={{ fontSize: "9px", fontFamily: MONO }}>
                      Queue HIGH-risk proposals for HITL demo.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => triggerHigh("wipe_terminal")}
                        className="w-full py-2 rounded border border-[#e05c6a40] text-[#e05c6a] hover:bg-[#e05c6a15] text-left px-2"
                        style={{ fontSize: "9px", fontFamily: MONO }}
                      >
                        <AlertTriangle size={12} className="inline mr-1 align-text-bottom" />
                        Trigger wipe_terminal
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerHigh("lock_cluster")}
                        className="w-full py-2 rounded border border-[#e8821a40] text-[#e8821a] hover:bg-[#e8821a15] text-left px-2"
                        style={{ fontSize: "9px", fontFamily: MONO }}
                      >
                        Trigger lock_cluster
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        </main>
      </div>

      <footer
        className="flex items-center justify-between px-5 h-11 border-t border-[#1a2640] shrink-0"
        style={{ background: "#0f1828" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border shrink-0"
            style={{ background: "#162035", borderColor: "#2a3a55" }}
          >
            <Shield size={11} className="text-[#4ac77e]" />
            <span className="text-[#4ac77e] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
              System Protection Active
            </span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
          {items.map((item) => (
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
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="absolute top-0 right-1 min-w-[12px] h-[12px] rounded-full flex items-center justify-center text-white"
                  style={{ fontSize: "7px", background: "#e05c6a" }}
                >
                  {item.badge > 9 ? "+" : item.badge}
                </span>
              )}
              {activeNav === item.id && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full"
                  style={{ background: "#3a6fff" }}
                />
              )}
            </button>
          ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
            <Shield size={11} />
            <span className="tracking-widest uppercase">ADMIN</span>
          </div>
          <div className="text-[#4a6080] text-right tabular-nums" style={{ fontSize: "10px", fontFamily: MONO }}>
            <div>{timeStr}</div>
            <div style={{ fontSize: "9px" }}>{dateStr}</div>
          </div>
        </div>
      </footer>
    </div>
    </AdminLabProvider>
  );
}
