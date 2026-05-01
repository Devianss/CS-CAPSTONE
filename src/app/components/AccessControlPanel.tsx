import { useState, useEffect, useRef } from "react";
import { Lock, Power, Shield, AlertTriangle, Activity, ChevronRight, X } from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

type NodeStatus = "normal" | "alert" | "offline" | "blocked" | "scanning";

const NODE_STYLE: Record<NodeStatus, { bg: string; border: string; dot: string }> = {
  normal:   { bg: "#162035", border: "#2a3a6a", dot: "#3a6fff" },
  alert:    { bg: "#3a1020", border: "#e05c6a", dot: "#e05c6a" },
  offline:  { bg: "#0d1320", border: "#1a2235", dot: "#2a3a55" },
  blocked:  { bg: "#2a1810", border: "#e8821a", dot: "#e8821a" },
  scanning: { bg: "#101e30", border: "#4ac77e", dot: "#4ac77e" },
};

function genNodes(count: number): { id: string; status: NodeStatus; label: string }[] {
  const statuses: NodeStatus[] = ["normal","normal","normal","normal","alert","blocked","offline","scanning","normal","normal"];
  return Array.from({ length: count }, (_, i) => ({
    id: `N-${String(i + 1).padStart(3, "0")}`,
    label: `STA-${String(i + 1).padStart(2, "0")}-C${Math.floor(i / 10) + 8}`,
    status: statuses[i % statuses.length],
  }));
}

const nodes = genNodes(40);

const realTimeLogs = [
  { time: "14:22:11", msg: "STA-03 authenticated (STD-001)", level: "info" },
  { time: "14:24:08", msg: "ALERT in TRF SPECIAL · 2 PCs", level: "warn" },
  { time: "14:26:44", msg: "Cluster on TRF SPECIAL · 5 PCs", level: "warn" },
  { time: "14:28:33", msg: "Security at PC · 0% of Unauthorized", level: "info" },
  { time: "14:30:02", msg: "Node scan complete · All nominal", level: "success" },
  { time: "14:31:55", msg: "STA-07 session terminated by admin", level: "warn" },
  { time: "14:33:10", msg: "AES-256 key rotation successful", level: "success" },
];

const levelStyle: Record<string, { color: string; prefix: string }> = {
  info:    { color: "#4a6fa5", prefix: "INFO" },
  warn:    { color: "#e8821a", prefix: "WARN" },
  success: { color: "#4ac77e", prefix: "OK  " },
};

export function AccessControlPanel() {
  const [lockConfirm, setLockConfirm] = useState(false);
  const [terminateConfirm, setTerminateConfirm] = useState(false);
  const [locked, setLocked] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [sessionNodes] = useState(() => 18);
  const [logs, setLogs] = useState(realTimeLogs);
  const logRef = useRef<HTMLDivElement>(null);

  // Simulate incoming log lines
  useEffect(() => {
    const msgs = [
      { msg: "Heartbeat check · All nodes responding", level: "info" },
      { msg: "STA-12 file transfer blocked by policy", level: "warn" },
      { msg: "Firewall rule PCU-FW-07 applied", level: "success" },
    ];
    let idx = 0;
    const t = setInterval(() => {
      const entry = msgs[idx % msgs.length];
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLogs((prev) => [{ time: timeStr, ...entry }, ...prev].slice(0, 20));
      idx++;
    }, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      {/* Header */}
      <div className="px-7 pt-5 pb-4 border-b border-[#1a2640]" style={{ background: "#0f1828" }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#3a6fff] animate-pulse" />
          <span className="text-[#4a6080] tracking-widest uppercase" style={{ fontSize: "8px", fontFamily: MONO }}>
            Security Protocol: Active
          </span>
        </div>
        <h1 className="text-[#c5d5ea]" style={{ fontSize: "26px", letterSpacing: "2px" }}>
          ACCESS GOVERNANCE
        </h1>
        <div className="flex items-center gap-6 mt-2">
          {[
            { label: "COMLAB 8", active: true },
            { label: "COMLAB 9", active: false },
            { label: "COMLAB 10", active: false },
            { label: "COMLAB 11", active: false },
          ].map((tab) => (
            <button
              key={tab.label}
              className="transition-colors"
              style={{
                color: tab.active ? "#7eb5f5" : "#2a3a55",
                fontSize: "10px",
                fontFamily: MONO,
                borderBottom: tab.active ? "1px solid #3a6fff" : "1px solid transparent",
                paddingBottom: "2px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 grid gap-5" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Left: Node Matrix */}
        <div className="space-y-5">
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-[#3a6fff]" />
                <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Node Matrix</span>
              </div>
              <div className="flex items-center gap-4">
                {(["normal","alert","blocked","offline"] as NodeStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: NODE_STYLE[s].dot }} />
                    <span className="text-[#4a6080] capitalize" style={{ fontSize: "8px", fontFamily: MONO }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(8, 1fr)" }}>
              {nodes.map((node) => {
                const sty = NODE_STYLE[node.status];
                return (
                  <div
                    key={node.id}
                    className="rounded-lg p-2 flex flex-col items-center gap-1.5 cursor-pointer hover:brightness-125 transition-all group"
                    style={{ background: sty.bg, border: `1px solid ${sty.border}` }}
                    title={`${node.label} · ${node.status.toUpperCase()}`}
                  >
                    {/* Node icon */}
                    <div className="relative">
                      <div
                        className="w-5 h-5 rounded-sm flex items-center justify-center"
                        style={{ background: sty.border + "30" }}
                      >
                        {node.status === "alert" && <AlertTriangle size={10} style={{ color: sty.dot }} />}
                        {node.status === "blocked" && <Lock size={10} style={{ color: sty.dot }} />}
                        {node.status === "scanning" && <Activity size={10} style={{ color: sty.dot }} />}
                        {(node.status === "normal" || node.status === "offline") && (
                          <div className="w-2 h-2 rounded-full" style={{ background: sty.dot }} />
                        )}
                      </div>
                    </div>
                    <span style={{ color: sty.dot, fontSize: "6px", fontFamily: MONO }}>{node.id}</span>
                    <span style={{ color: "#2a3a55", fontSize: "6px", fontFamily: MONO }}>{node.label.slice(0, 8)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Integrity */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center gap-2 mb-5">
              <Shield size={13} className="text-[#3a6fff]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Session Integrity</span>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>Active Nodes</p>
                <div className="flex items-end gap-2">
                  <span className="text-[#c5d5ea]" style={{ fontSize: "36px", fontFamily: MONO, lineHeight: 1 }}>{sessionNodes}</span>
                  <span className="text-[#2a3a55] mb-1" style={{ fontSize: "14px", fontFamily: MONO }}>/30</span>
                </div>
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                  <div className="h-full rounded-full" style={{ width: `${(sessionNodes / 30) * 100}%`, background: "#3a6fff" }} />
                </div>
              </div>
              <div>
                <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>Access Hits</p>
                <span className="text-[#c5d5ea]" style={{ fontSize: "36px", fontFamily: MONO, lineHeight: 1 }}>1,248</span>
              </div>
              <div>
                <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>Solar Nodes</p>
                <span className="text-[#c5d5ea]" style={{ fontSize: "36px", fontFamily: MONO, lineHeight: 1 }}>82</span>
              </div>
            </div>

            {/* Real-time logs */}
            <div className="mt-5">
              <p className="text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>Real-Time Logs</p>
              <div
                ref={logRef}
                className="space-y-1 overflow-y-auto pr-1"
                style={{ maxHeight: "140px" }}
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{ color: "#2a3a55", fontSize: "9px", fontFamily: MONO, flexShrink: 0 }}>{log.time}</span>
                    <span style={{ color: levelStyle[log.level].color, fontSize: "9px", fontFamily: MONO, flexShrink: 0 }}>
                      [{levelStyle[log.level].prefix}]
                    </span>
                    <span style={{ color: "#6a7a90", fontSize: "9px", fontFamily: MONO }}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Command Override + Security */}
        <div className="space-y-4">
          {/* Command Override */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#e05c6a]" />
              <span className="text-[#e05c6a]" style={{ fontSize: "11px", fontFamily: MONO }}>COMMAND OVERRIDE</span>
            </div>
            <div className="h-[1px] bg-[#1a2640] mb-4" />

            {/* Lock Cluster */}
            <div
              className="p-4 rounded-lg mb-3 cursor-pointer hover:brightness-110 transition-all border"
              style={{ background: "#162035", borderColor: locked ? "#4ac77e" : "#2a3a55" }}
              onClick={() => setLockConfirm(true)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>Lock Cluster</span>
                <Lock size={14} style={{ color: locked ? "#4ac77e" : "#4a6080" }} />
              </div>
              <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                {locked ? "Cluster locked · AES-256 secured" : "Freeze all nodes in COMLAB 08"}
              </p>
              {locked && (
                <p className="text-[#4ac77e] mt-1" style={{ fontSize: "8px", fontFamily: MONO }}>● ACTIVE</p>
              )}
            </div>

            {/* Terminate All Sessions */}
            <div
              className="p-4 rounded-lg cursor-pointer hover:brightness-110 transition-all border"
              style={{
                background: terminated ? "#1a0d0d" : "#1a0d18",
                borderColor: terminated ? "#4a6080" : "#e05c6a50",
              }}
              onClick={() => setTerminateConfirm(true)}
            >
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: terminated ? "#4a6080" : "#e05c6a", fontSize: "12px" }}>
                  Terminate All Sessions
                </span>
                <Power size={14} style={{ color: terminated ? "#4a6080" : "#e05c6a" }} />
              </div>
              <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                {terminated ? "All sessions cleared" : "Immediately force-sign all active users"}
              </p>
            </div>

            <div className="h-[1px] bg-[#1a2640] my-4" />

            {/* Security notification */}
            <div>
              <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>
                Security Notifications
              </p>
              <p className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>
                Scanning · Runa engine: Standby...
              </p>
            </div>
          </div>

          {/* Node quick stats */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <p className="text-[#4a6080] tracking-widest uppercase mb-4" style={{ fontSize: "8px", fontFamily: MONO }}>
              Node Health Summary
            </p>
            {([
              { label: "Normal", count: nodes.filter(n => n.status === "normal").length, color: "#3a6fff" },
              { label: "Alert", count: nodes.filter(n => n.status === "alert").length, color: "#e05c6a" },
              { label: "Blocked", count: nodes.filter(n => n.status === "blocked").length, color: "#e8821a" },
              { label: "Offline", count: nodes.filter(n => n.status === "offline").length, color: "#2a3a55" },
              { label: "Scanning", count: nodes.filter(n => n.status === "scanning").length, color: "#4ac77e" },
            ]).map((row) => (
              <div key={row.label} className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                  <span className="text-[#c5d5ea]" style={{ fontSize: "11px" }}>{row.label}</span>
                </div>
                <div className="flex items-center gap-3 flex-1 ml-4">
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.count / nodes.length) * 100}%`, background: row.color }}
                    />
                  </div>
                  <span style={{ color: row.color, fontSize: "10px", fontFamily: MONO, width: "20px", textAlign: "right" }}>
                    {row.count}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions Legend */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <p className="text-[#4a6080] tracking-widest uppercase mb-4" style={{ fontSize: "8px", fontFamily: MONO }}>
              Available Actions
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Lock size={12} className="text-[#3a6fff] mt-0.5" />
                <div>
                  <p className="text-[#c5d5ea]" style={{ fontSize: "10px" }}>Lock Node</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "8px" }}>Freeze terminal access</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Power size={12} className="text-[#e05c6a] mt-0.5" />
                <div>
                  <p className="text-[#c5d5ea]" style={{ fontSize: "10px" }}>Terminate</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "8px" }}>Force sign-out user</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Activity size={12} className="text-[#4ac77e] mt-0.5" />
                <div>
                  <p className="text-[#c5d5ea]" style={{ fontSize: "10px" }}>Scan Node</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "8px" }}>Run security check</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield size={12} className="text-[#e8821a] mt-0.5" />
                <div>
                  <p className="text-[#c5d5ea]" style={{ fontSize: "10px" }}>Block Access</p>
                  <p className="text-[#4a6080]" style={{ fontSize: "8px" }}>Restrict permanently</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Confirm Modal */}
      {lockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-xl p-6 border shadow-2xl" style={{ background: "#111d30", borderColor: "#2a3a55", width: "340px" }}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-[#4a6fa5]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "14px" }}>Confirm Cluster Lock</span>
            </div>
            <p className="text-[#4a6080] mb-5" style={{ fontSize: "11px", fontFamily: MONO }}>
              This will freeze all active nodes in COMLAB 08. Students will be unable to interact with terminals until unlocked.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setLocked(true); setLockConfirm(false); }}
                className="flex-1 py-2 rounded-md text-white transition-colors"
                style={{ background: "#3a6fff", fontSize: "11px", fontFamily: MONO }}
              >
                CONFIRM LOCK
              </button>
              <button
                onClick={() => setLockConfirm(false)}
                className="flex-1 py-2 rounded-md border transition-colors"
                style={{ borderColor: "#2a3a55", color: "#4a6080", fontSize: "11px", fontFamily: MONO }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Confirm Modal */}
      {terminateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-xl p-6 border shadow-2xl" style={{ background: "#1a0d18", borderColor: "#e05c6a50", width: "340px" }}>
            <div className="flex items-center gap-2 mb-3">
              <Power size={16} className="text-[#e05c6a]" />
              <span className="text-[#e05c6a]" style={{ fontSize: "14px" }}>Terminate All Sessions?</span>
            </div>
            <p className="text-[#a07080] mb-5" style={{ fontSize: "11px", fontFamily: MONO }}>
              This will immediately force-sign all {sessionNodes} active users. This action is logged and irreversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setTerminated(true); setTerminateConfirm(false); }}
                className="flex-1 py-2 rounded-md text-white transition-colors"
                style={{ background: "#e05c6a", fontSize: "11px", fontFamily: MONO }}
              >
                TERMINATE
              </button>
              <button
                onClick={() => setTerminateConfirm(false)}
                className="flex-1 py-2 rounded-md border transition-colors"
                style={{ borderColor: "#2a3a55", color: "#4a6080", fontSize: "11px", fontFamily: MONO }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
