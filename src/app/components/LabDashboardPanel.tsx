import { useState, useEffect } from "react";
import { AlertTriangle, Activity, Wifi, Lock, ChevronRight, MoreHorizontal } from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

type TerminalStatus = "active" | "idle" | "alert" | "offline" | "blocked";

const STATUS_COLOR: Record<TerminalStatus, string> = {
  active: "#3a6fff",
  idle: "#1e3055",
  alert: "#e05c6a",
  offline: "#1a2235",
  blocked: "#e8821a",
};

const STATUS_BORDER: Record<TerminalStatus, string> = {
  active: "#3a6fff",
  idle: "#2a3a55",
  alert: "#e05c6a",
  offline: "#1a2235",
  blocked: "#e8821a",
};

function generateGrid(rows: number, cols: number, alertIdx?: number, blockedIdx?: number): TerminalStatus[] {
  return Array.from({ length: rows * cols }, (_, i) => {
    if (i === alertIdx) return "alert";
    if (i === blockedIdx) return "blocked";
    const r = Math.random();
    if (r < 0.55) return "active";
    if (r < 0.75) return "idle";
    if (r < 0.85) return "offline";
    return "idle";
  });
}

const comlabs = [
  { id: "08", label: "COMLAB 08", subject: "CYBERSECURITY", rows: 4, cols: 8, alertIdx: 2, blockedIdx: -1, util: 87 },
  { id: "09", label: "COMLAB 09", subject: "APPLICATION DEVELOPMENT", rows: 4, cols: 8, alertIdx: -1, blockedIdx: -1, util: 72 },
  { id: "10", label: "COMLAB 10", subject: "ICT", rows: 4, cols: 8, alertIdx: -1, blockedIdx: 3, util: 60 },
  { id: "11", label: "COMLAB 11", subject: "CAPRES", rows: 4, cols: 8, alertIdx: -1, blockedIdx: 25, util: 20 },
];

const securityEvents = [
  { time: "14:22:31", icon: "login", msg: "User: ENGR-DE-GUZMAN-082 — Granted access to Comlab 08", level: "secure" },
  { time: "14:26:08", icon: "alert", msg: "Unknown Device Detected — Comlab 11 · Port 13 · Hardware integrity check failed", level: "critical" },
  { time: "14:31:00", icon: "sync", msg: "System Scheduled Update — Node synchronization for RUNA protocols", level: "system" },
];

const levelColors: Record<string, string> = {
  secure: "#4ac77e",
  critical: "#e05c6a",
  system: "#4a6fa5",
};

function ComLabGrid({ rows, cols, alertIdx, blockedIdx, statuses }: {
  rows: number; cols: number; alertIdx: number; blockedIdx: number; statuses: TerminalStatus[];
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {statuses.map((s, i) => (
        <div
          key={i}
          className="rounded-sm flex flex-col items-center justify-center gap-0.5"
          style={{
            width: "100%",
            aspectRatio: "1",
            background: STATUS_COLOR[s],
            border: `1px solid ${STATUS_BORDER[s]}`,
            opacity: s === "offline" ? 0.3 : 1,
          }}
        >
          <span style={{ color: STATUS_BORDER[s], fontSize: "7px", fontFamily: MONO }}>
            PC{String(i + 1).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LabDashboardPanel() {
  const [grids] = useState(() =>
    comlabs.map((c) => generateGrid(c.rows, c.cols, c.alertIdx, c.blockedIdx))
  );
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#1a2640]" style={{ background: "#0f1828" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "9px", fontFamily: MONO }}>
              System Pulse
            </p>
            <h1 className="text-[#c5d5ea]" style={{ fontSize: "26px", letterSpacing: "-0.5px" }}>
              REAL-TIME<br />LAB MATRIX
            </h1>
            <p className="text-[#4a6080] mt-1" style={{ fontSize: "11px" }}>
              Live monitoring of terminal connectivity and status.
            </p>
          </div>
          <div className="flex items-end gap-8">
            <div className="text-right">
              <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Global Utilization</p>
              <p className="text-[#c5d5ea]" style={{ fontSize: "32px", fontFamily: MONO, lineHeight: 1 }}>84.2<span style={{ fontSize: "18px", color: "#4a6080" }}>%</span></p>
            </div>
            <div className="text-right">
              <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Action Alerts</p>
              <p className="text-[#e05c6a]" style={{ fontSize: "32px", fontFamily: MONO, lineHeight: 1 }}>02</p>
            </div>
            <div className="text-right">
              <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>UTC Time</p>
              <p className="text-[#7eb5f5]" style={{ fontSize: "13px", fontFamily: MONO }}>{timeStr}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* COMLAB Grids */}
        <div className="grid grid-cols-2 gap-5">
          {comlabs.map((lab, idx) => (
            <div
              key={lab.id}
              className="rounded-xl p-4 border"
              style={{ background: "#111d30", borderColor: "#1e2e48" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: lab.util > 70 ? "#e05c6a" : lab.util > 40 ? "#e8821a" : "#4a6080" }}
                  />
                  <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>{lab.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[#4a6fa5] border border-[#1e2e48]"
                    style={{ fontSize: "8px", fontFamily: MONO }}
                  >
                    SUBJECT: {lab.subject}
                  </span>
                </div>
              </div>
              <ComLabGrid
                rows={lab.rows}
                cols={lab.cols}
                alertIdx={lab.alertIdx}
                blockedIdx={lab.blockedIdx}
                statuses={grids[idx]}
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#3a6fff" }} />
                    <span className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#e05c6a" }} />
                    <span className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>ALERT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#1e3055" }} />
                    <span className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>IDLE</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#e8821a" }} />
                    <span className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>BLOCKED</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#1a2235", opacity: 0.3 }} />
                    <span className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>OFFLINE</span>
                  </div>
                </div>
                <span style={{ color: "#4a6080", fontSize: "9px", fontFamily: MONO }}>{lab.util}% UTIL</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-5">
          {/* Security Events */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Recent Security Events</span>
              <button className="text-[#4a6080] hover:text-[#7eb5f5] transition-colors"><MoreHorizontal size={14} /></button>
            </div>
            <div className="space-y-3">
              {securityEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#2a3a55] shrink-0" style={{ fontSize: "9px", fontFamily: MONO, paddingTop: "2px" }}>{ev.time}</span>
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                    style={{ background: levelColors[ev.level] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#a0b0c0]" style={{ fontSize: "10px" }}>{ev.msg}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: levelColors[ev.level] + "20",
                      color: levelColors[ev.level],
                      fontSize: "8px",
                      fontFamily: MONO,
                    }}
                  >
                    {ev.level.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Load Factor */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={13} className="text-[#3a6fff]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Lab Load Factor</span>
            </div>
            <div className="space-y-4">
              {comlabs.map((lab) => (
                <div key={lab.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[#c5d5ea]" style={{ fontSize: "11px", fontFamily: MONO }}>{lab.label}</span>
                    <span style={{ color: lab.util > 70 ? "#e05c6a" : lab.util > 40 ? "#e8821a" : "#4a6080", fontSize: "11px", fontFamily: MONO }}>
                      {lab.util}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${lab.util}%`,
                        background: lab.util > 70 ? "#e05c6a" : lab.util > 40 ? "#e8821a" : "#4a6080",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-[#1a2640] flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e05c6a]" />
                <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>HIGH (&gt;70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e8821a]" />
                <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>MED (40–70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#4a6080]" />
                <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>LOW (&lt;40%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}