import { useState, useEffect, useCallback } from "react";
import { useNotificationContext } from "../providers/NotificationProvider";
import { useElectron } from "../ipc/useElectron";
import { useAdminLab } from "../context/AdminLabContext";
import { COMLAB_DEFINITIONS, getComlab } from "../data/comlabs";
import {
  Download,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Shield,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

const AUDIT_LAB_KEYS = COMLAB_DEFINITIONS.map((c) => c.auditLogKey);

type SecurityEvent =
  | { type: "scan"; label: string; color: string }
  | { type: "blocked"; label: string; color: string }
  | { type: "monitoring"; label: string; color: string }
  | { type: "identity"; label: string; color: string };

interface StationLog {
  id: string;
  station: string;
  student: string;
  studentId: string;
  inTime: string;
  outTime: string | null;
  /** Session calendar date (YYYY-MM-DD) for institutional date filter */
  date: string;
  event: SecurityEvent;
}

const logsPerLab: Record<string, StationLog[]> = {
  "COMLAB 8": [
    {
      id: "1",
      station: "C08-PC05",
      student: "Casio, Gen Benedict",
      studentId: "202110299",
      inTime: "13:00:14",
      outTime: null,
      date: "2026-04-21",
      event: { type: "scan", label: "System Scan Complete", color: "#4ac77e" },
    },
    {
      id: "2",
      station: "C08-PC12",
      student: "Santos, Maria Clara",
      studentId: "202211548",
      inTime: "13:05:00",
      outTime: "14:30:22",
      date: "2026-04-22",
      event: { type: "blocked", label: "File Blocked", color: "#e05c6a" },
    },
    {
      id: "3",
      station: "C08-PC28",
      student: "Reyes, Jonathan P.",
      studentId: "202116056",
      inTime: "13:12:45",
      outTime: null,
      date: "2026-04-21",
      event: { type: "monitoring", label: "Active Monitoring", color: "#4a6fa5" },
    },
    {
      id: "4",
      station: "C08-PC33",
      student: "Dela Rosa, Karen",
      studentId: "202318892",
      inTime: "13:15:20",
      outTime: null,
      date: "2026-04-22",
      event: { type: "identity", label: "Identity Verified", color: "#4a6fa5" },
    },
    {
      id: "5",
      station: "C08-PC07",
      student: "Abad, Marco Luis",
      studentId: "202209871",
      inTime: "12:58:44",
      outTime: "14:02:11",
      date: "2026-04-21",
      event: { type: "scan", label: "System Scan Complete", color: "#4ac77e" },
    },
    {
      id: "6",
      station: "C08-PC19",
      student: "Mercado, Alex",
      studentId: "202315540",
      inTime: "13:21:08",
      outTime: null,
      date: "2026-04-22",
      event: { type: "monitoring", label: "Active Monitoring", color: "#4a6fa5" },
    },
  ],
  "COMLAB 9": [
    {
      id: "7",
      station: "C09-PC02",
      student: "Garcia, Sofia N.",
      studentId: "202210034",
      inTime: "10:02:19",
      outTime: null,
      date: "2026-04-21",
      event: { type: "scan", label: "System Scan Complete", color: "#4ac77e" },
    },
    {
      id: "8",
      station: "C09-PC14",
      student: "Torres, Jericho M.",
      studentId: "202117782",
      inTime: "10:05:55",
      outTime: null,
      date: "2026-04-22",
      event: { type: "identity", label: "Identity Verified", color: "#4a6fa5" },
    },
  ],
  "COMLAB 10": [
    {
      id: "9",
      station: "C10-PC01",
      student: "Navarro, Czarina B.",
      studentId: "202318001",
      inTime: "08:01:44",
      outTime: "10:55:30",
      date: "2026-04-21",
      event: { type: "scan", label: "System Scan Complete", color: "#4ac77e" },
    },
  ],
  "COMLAB 11": [
    {
      id: "10",
      station: "C11-PC03",
      student: "Lim, Danielle",
      studentId: "202215678",
      inTime: "13:00:00",
      outTime: null,
      date: "2026-04-22",
      event: { type: "blocked", label: "File Blocked", color: "#e05c6a" },
    },
  ],
};

const capacities: Record<string, { current: number; total: number }> = Object.fromEntries(
  COMLAB_DEFINITIONS.map((c) => [
    c.auditLogKey,
    { current: Math.round((c.utilizationPercent / 100) * 40), total: 40 },
  ]),
);

const sessions: Record<string, { subject: string; prof: string }> = Object.fromEntries(
  COMLAB_DEFINITIONS.map((c) => [c.auditLogKey, { subject: c.subject, prof: c.professorName }]),
);

function EventBadge({ event }: { event: SecurityEvent }) {
  const icons: Record<string, React.ReactNode> = {
    scan: <CheckCircle size={10} />,
    blocked: <AlertTriangle size={10} />,
    monitoring: <Shield size={10} />,
    identity: <Shield size={10} />,
  };
  if (event.type === "blocked") {
    return (
      <span
        className="flex items-center gap-1 px-2 py-1 rounded"
        style={{ background: event.color + "25", color: event.color, fontSize: "9px", fontFamily: MONO, border: `1px solid ${event.color}50` }}
      >
        {icons[event.type]}
        {event.label.toUpperCase()}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: event.color }} />
      <span style={{ color: "#c5d5ea", fontSize: "10px" }}>{event.label}</span>
    </div>
  );
}

type AuditSurface = "hardware" | "runa";

interface RunaAuditRow {
  id: number;
  createdAt: number;
  eventType: string;
  actorUserId: string;
  actorRole?: string;
  riskTier?: string;
  approvalId?: string;
}

const PAGE_SIZE = 10;

export function AuditTrailsPanel() {
  const { pushToast } = useNotificationContext();
  const electron = useElectron();
  const { labId, setLabId } = useAdminLab();
  const [surface, setSurface] = useState<AuditSurface>("hardware");
  const [runaRows, setRunaRows] = useState<RunaAuditRow[]>([]);
  const [activeTab, setActiveTab] = useState(COMLAB_DEFINITIONS[0].auditLogKey);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("2026-04-21");
  const [dateTo, setDateTo] = useState("2026-04-21");
  const [lockedStations, setLockedStations] = useState<Set<string>>(() => new Set());

  const refreshRuna = useCallback(async () => {
    try {
      const rows = await electron.audit.list(200);
      setRunaRows(rows as RunaAuditRow[]);
    } catch {
      setRunaRows([]);
    }
  }, [electron]);

  useEffect(() => {
    if (surface !== "runa") return;
    void refreshRuna();
  }, [surface, refreshRuna]);

  useEffect(() => {
    setActiveTab(getComlab(labId).auditLogKey);
  }, [labId]);

  const logs = logsPerLab[activeTab] ?? [];
  const filtered = logs.filter((l) => {
    const matchesSearch =
      l.student.toLowerCase().includes(search.toLowerCase()) ||
      l.station.toLowerCase().includes(search.toLowerCase()) ||
      l.studentId.includes(search);

    const matchesDate = (() => {
      if (!dateFrom && !dateTo) return true;
      const rowDate = l.date;
      if (!rowDate) return true;
      if (dateFrom && rowDate < dateFrom) return false;
      if (dateTo && rowDate > dateTo) return false;
      return true;
    })();

    return matchesSearch && matchesDate;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cap = capacities[activeTab];
  const sess = sessions[activeTab];
  const securityFlags = logs.filter((l) => l.event.type === "blocked").length;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      <div className="sticky top-0 z-[var(--z-banner)] flex gap-2 px-4 py-2 border-b border-[#1a2640]" style={{ background: "#0a1020" }}>
        <button
          type="button"
          onClick={() => setSurface("hardware")}
          className="px-3 py-1.5 rounded border transition-colors"
          style={{
            fontFamily: MONO,
            fontSize: "10px",
            borderColor: surface === "hardware" ? "#3a6fff" : "#2a3a55",
            color: surface === "hardware" ? "#c5d5ea" : "#4a6080",
            background: surface === "hardware" ? "#162035" : "transparent",
          }}
        >
          Institutional attendance
        </button>
        <button
          type="button"
          onClick={() => setSurface("runa")}
          className="px-3 py-1.5 rounded border transition-colors"
          style={{
            fontFamily: MONO,
            fontSize: "10px",
            borderColor: surface === "runa" ? "#3a6fff" : "#2a3a55",
            color: surface === "runa" ? "#c5d5ea" : "#4a6080",
            background: surface === "runa" ? "#162035" : "transparent",
          }}
        >
          RUNA agent / HITL log
        </button>
      </div>

      {surface === "runa" ? (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[#c5d5ea]" style={{ fontSize: "13px", fontFamily: GROTESK }}>
              Events persisted in electron-store (login, scans, chat, HITL decisions).
            </p>
            <button
              type="button"
              onClick={() => void refreshRuna()}
              className="shrink-0 px-3 py-1.5 rounded border text-[#7eb5f5] hover:bg-[#1e2e48] transition-colors"
              style={{ fontSize: "10px", fontFamily: MONO, borderColor: "#2a3a55" }}
            >
              Refresh
            </button>
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div
              className="grid px-4 py-2 border-b border-[#1a2640] text-[#4a6080] uppercase tracking-widest"
              style={{
                fontSize: "8px",
                fontFamily: MONO,
                gridTemplateColumns: "56px 130px minmax(0,1fr) 88px 56px minmax(0,0.8fr)",
              }}
            >
              <span>ID</span>
              <span>Time</span>
              <span>Event</span>
              <span>Actor</span>
              <span>Risk</span>
              <span>Approval</span>
            </div>
            {runaRows.length === 0 ? (
              <p className="py-8 text-center text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>
                No audit rows yet. Log in, use the assistant, file scan, or approvals queue.
              </p>
            ) : (
              runaRows.map((row) => (
                <div
                  key={row.id}
                  className="grid px-4 py-2 border-b border-[#1a2640] items-start gap-x-1"
                  style={{
                    gridTemplateColumns: "56px 130px minmax(0,1fr) 88px 56px minmax(0,0.8fr)",
                    fontSize: "10px",
                    fontFamily: MONO,
                  }}
                >
                  <span className="text-[#7eb5f5]">{row.id}</span>
                  <span className="text-[#4a6080]">
                    {new Date(row.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="text-[#c5d5ea] break-all">{row.eventType}</span>
                  <span className="text-[#4a6080] truncate" title={row.actorUserId}>{row.actorUserId}</span>
                  <span className="text-[#a06820]">{row.riskTier ?? "—"}</span>
                  <span className="text-[#2a3a55] truncate" title={row.approvalId ?? ""}>{row.approvalId ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="px-7 pt-5 pb-4 border-b border-[#1a2640]" style={{ background: "#0f1828" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>
              Institutional Resource Monitor
            </p>
            <h1 className="text-[#c5d5ea]" style={{ fontSize: "26px", lineHeight: 1.15 }}>
              Laboratory Attendance &amp;<br />Security Log
            </h1>
          </div>
          <div className="text-right mt-2">
            <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>System Status</p>
            <p style={{ color: "#e8821a", fontSize: "14px", fontFamily: MONO }}>SECURE /</p>
            <p style={{ color: "#4ac77e", fontSize: "14px", fontFamily: MONO }}>OPERATIONAL</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mt-5">
          {AUDIT_LAB_KEYS.map((lab) => (
            <button
              key={lab}
              type="button"
              onClick={() => {
                setActiveTab(lab);
                setPage(1);
                const d = COMLAB_DEFINITIONS.find((c) => c.auditLogKey === lab);
                if (d) setLabId(d.id);
              }}
              className="transition-all pb-1"
              style={{
                color: activeTab === lab ? "#c5d5ea" : "#4a6080",
                fontSize: "13px",
                borderBottom: activeTab === lab ? "2px solid #3a6fff" : "2px solid transparent",
              }}
            >
              {lab}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors hover:bg-[#1e2e48]"
              style={{ borderColor: "#2a3a55", color: "#7eb5f5" }}
            >
              <Filter size={12} />
              <span style={{ fontSize: "10px", fontFamily: MONO }}>FILTER BY DATE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <div className="px-7 py-4 border-b border-[#1a2640]" style={{ background: "#111d30" }}>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>
                FROM DATE
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-md border bg-transparent text-[#c5d5ea]"
                style={{ borderColor: "#2a3a55", fontSize: "11px", fontFamily: MONO }}
              />
            </div>
            <div>
              <label className="block text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>
                TO DATE
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-md border bg-transparent text-[#c5d5ea]"
                style={{ borderColor: "#2a3a55", fontSize: "11px", fontFamily: MONO }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setShowDateFilter(false);
              }}
              className="mt-6 px-4 py-1.5 rounded-md border transition-colors hover:bg-[#3a6fff]"
              style={{ borderColor: "#3a6fff", color: "#7eb5f5", fontSize: "10px", fontFamily: MONO }}
            >
              APPLY FILTER
            </button>
            <button
              onClick={() => setShowDateFilter(false)}
              className="mt-6 px-4 py-1.5 rounded-md border transition-colors hover:bg-[#1e2e48]"
              style={{ borderColor: "#2a3a55", color: "#4a6080", fontSize: "10px", fontFamily: MONO }}
            >
              CLOSE
            </button>
            <div className="ml-auto mt-6">
              <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
                Selected Range: {dateFrom} to {dateTo}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 grid gap-5" style={{ gridTemplateColumns: "220px 1fr" }}>
        {/* Left stats column */}
        <div className="space-y-4">
          {/* Current Capacity */}
          <div
            className="rounded-xl p-5 border"
            style={{ background: "#111d30", borderColor: "#1e2e48" }}
          >
            <p className="text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Current Capacity
            </p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-[#c5d5ea]" style={{ fontSize: "42px", fontFamily: MONO, lineHeight: 1 }}>{cap.current}</span>
              <span className="text-[#4a6080] mb-1" style={{ fontSize: "16px", fontFamily: MONO }}>/ {cap.total} UNITS</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2640" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(cap.current / cap.total) * 100}%`, background: "#3a6fff" }}
              />
            </div>
          </div>

          {/* Security Flags */}
          <div
            className="rounded-xl p-5 border"
            style={{ background: "#111d30", borderColor: "#1e2e48" }}
          >
            <p className="text-[#4a6080] tracking-widest uppercase mb-3" style={{ fontSize: "8px", fontFamily: MONO }}>
              Security Flags
            </p>
            <div className="flex items-end gap-3">
              <span style={{ color: "#e8821a", fontSize: "42px", fontFamily: MONO, lineHeight: 1 }}>
                {String(securityFlags).padStart(2, "0")}
              </span>
              <span style={{ color: "#4ac77e", fontSize: "11px", fontFamily: MONO, marginBottom: "4px" }}>RESOLVED</span>
            </div>
          </div>

          {/* Active Session */}
          <div
            className="rounded-xl p-5 border"
            style={{ background: "#111d30", borderColor: "#1e2e48" }}
          >
            <p className="text-[#4a6080] tracking-widest uppercase mb-4" style={{ fontSize: "8px", fontFamily: MONO }}>
              Active Session
            </p>
            <p className="text-[#4a6080] uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Subject</p>
            <p className="text-[#c5d5ea] mb-4" style={{ fontSize: "13px" }}>{sess.subject}</p>
            <p className="text-[#4a6080] uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Professor</p>
            <p className="text-[#7eb5f5]" style={{ fontSize: "13px" }}>{sess.prof}</p>
          </div>
        </div>

        {/* Right: Logs table */}
        <div>
          <div
            className="rounded-xl border overflow-x-auto overflow-y-hidden"
            style={{ background: "#111d30", borderColor: "#1e2e48" }}
          >
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2640]">
              <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>
                Station Logs: {activeTab.toUpperCase()}
              </span>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md"
                  style={{ background: "#0d1320", border: "1px solid #1e2e48" }}
                >
                  <Search size={12} className="text-[#4a6080]" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search..."
                    className="bg-transparent outline-none text-[#c5d5ea] placeholder-[#4a6080]"
                    style={{ fontSize: "11px", fontFamily: MONO, width: "100px" }}
                  />
                </div>
                <button
                  onClick={() => {
                    const csvContent = [
                      ["Station ID", "Student Name", "Student ID", "Time In", "Time Out", "Security Event"],
                      ...filtered.map(log => [
                        log.station,
                        log.student,
                        log.studentId,
                        log.inTime,
                        log.outTime || "N/A",
                        log.event.label
                      ])
                    ].map(row => row.join(",")).join("\n");

                    const blob = new Blob([csvContent], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${activeTab}_logs_${dateFrom}_to_${dateTo}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors hover:bg-[#1e2e48]"
                  style={{ borderColor: "#2a3a55", color: "#7eb5f5", fontSize: "10px", fontFamily: MONO }}
                >
                  <Download size={11} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div
              className="grid px-5 py-2"
              style={{
                gridTemplateColumns: "110px 1fr 100px 130px 90px",
                background: "#0d1320",
                borderBottom: "1px solid #1a2640",
              }}
            >
              {["STATION ID", "STUDENT ACCOUNTABILITY", "TEMPORAL LOG", "SECURITY EVENT", "ACTION"].map((col) => (
                <span key={col} className="text-[#4a6080] tracking-widest" style={{ fontSize: "8px", fontFamily: MONO }}>
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            {paged.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>No records found</p>
              </div>
            ) : (
              paged.map((log) => (
                <div
                  key={log.id}
                  className={`grid items-center px-5 py-4 border-b border-[#1a2640] hover:bg-[#162035] transition-colors group ${
                    lockedStations.has(log.station) ? "opacity-50" : ""
                  }`}
                  style={{ gridTemplateColumns: "110px 1fr 100px 130px 90px" }}
                >
                  {/* Station */}
                  <span style={{ color: "#7eb5f5", fontSize: "11px", fontFamily: MONO }}>{log.station}</span>

                  {/* Student */}
                  <div>
                    <p className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>{log.student}</p>
                    <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>{log.studentId}</p>
                  </div>

                  {/* Temporal Log */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-[#4ac77e]" />
                      <span style={{ color: "#4a6080", fontSize: "9px", fontFamily: MONO }}>IN:</span>
                      <span style={{ color: "#c5d5ea", fontSize: "9px", fontFamily: MONO }}>{log.inTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1 h-1 rounded-full" style={{ background: log.outTime ? "#e05c6a" : "#2a3a55" }} />
                      <span style={{ color: "#4a6080", fontSize: "9px", fontFamily: MONO }}>OUT:</span>
                      <span style={{ color: log.outTime ? "#c5d5ea" : "#2a3a55", fontSize: "9px", fontFamily: MONO }}>
                        {log.outTime ?? "— : — : —"}
                      </span>
                    </div>
                  </div>

                  {/* Security Event */}
                  <EventBadge event={log.event} />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded text-[#e05c6a] border border-[#e05c6a30] hover:bg-[#e05c6a20] transition-colors"
                      style={{ fontSize: "8px", fontFamily: MONO }}
                      onClick={() => {
                        let locking = false;
                        setLockedStations((prev) => {
                          const next = new Set(prev);
                          locking = !next.has(log.station);
                          if (next.has(log.station)) next.delete(log.station);
                          else next.add(log.station);
                          return next;
                        });
                        if (locking) pushToast(`Station ${log.station} locked`, "warn");
                      }}
                    >
                      LOCK
                    </button>
                    <button type="button" className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors ml-1">
                      <MoreVertical size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3">
              <span style={{ color: "#4a6080", fontSize: "10px", fontFamily: MONO }}>
                Showing {filtered.length === 0 ? 0 : Math.min(PAGE_SIZE, paged.length)} of {filtered.length} rows
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    color: page === 1 ? "#2a3a55" : "#7eb5f5",
                    fontSize: 10,
                    fontFamily: MONO,
                    background: "none",
                    border: "none",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    padding: "0 4px",
                  }}
                >
                  PREV
                </button>
                <span style={{ color: "#4a6080", fontSize: "10px", fontFamily: MONO }}>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    color: page === totalPages ? "#2a3a55" : "#7eb5f5",
                    fontSize: 10,
                    fontFamily: MONO,
                    background: "none",
                    border: "none",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    padding: "0 4px",
                  }}
                >
                  NEXT
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom ticker */}
      <div
        className="flex items-center gap-2 px-6 py-2 border-t border-[#1a2640]"
        style={{ background: "#0a1020" }}
      >
        <div className="w-2 h-2 rounded-full bg-[#4ac77e]" />
        <span style={{ color: "#4a6080", fontSize: "9px", fontFamily: MONO }}>
          SESSION ENGINE: UPDATED {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} &nbsp;|&nbsp;
          ALL SECURITY PROTOCOLS NOMINAL &nbsp;|&nbsp;
          COMLAB 8-11 CONNECTED
        </span>
      </div>
      </>
      )}
    </div>
  );
}
