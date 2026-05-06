import { useState, useEffect, useCallback, useMemo } from "react";
import { useElectron } from "../ipc/useElectron";
import { useAdminLab } from "../context/AdminLabContext";
import { COMLAB_DEFINITIONS, getComlab } from "../data/comlabs";
import { ADMIN_FONT_MONO, ADMIN_FONT_SANS, ADMIN_HEADER_TITLE_SIZE, ADMIN_PANEL_CLASS, ADMIN_PANEL_STYLE } from "./admin/adminUiTokens";
import {
  Download,
  Filter,
  CheckCircle,
  AlertTriangle,
  Shield,
  Search,
} from "lucide-react";

const MONO = ADMIN_FONT_MONO;
const GROTESK = ADMIN_FONT_SANS;

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

function mapEventType(eventType: string): SecurityEvent {
  if (eventType.includes("blocked") || eventType.includes("hard_failed")) {
    return { type: "blocked", label: "Policy Blocked", color: "#e05c6a" };
  }
  if (eventType.includes("scan")) return { type: "scan", label: "System Scan", color: "#4ac77e" };
  if (eventType.includes("presence")) return { type: "identity", label: "Presence Heartbeat", color: "#4a6fa5" };
  return { type: "monitoring", label: "Monitoring Event", color: "#4a6fa5" };
}

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
  detail: string;
  actorUserId: string;
  actorRole?: string;
  riskTier?: string;
  approvalId?: string;
  approverUserId?: string;
  confidenceScore?: number;
}

const PAGE_SIZE = 10;

export function AuditTrailsPanel() {
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
    if (surface !== "hardware") return;
    void refreshRuna();
  }, [surface, refreshRuna]);

  useEffect(() => {
    setActiveTab(getComlab(labId).auditLogKey);
  }, [labId]);

  const logs = useMemo(() => {
    const mapped: StationLog[] = runaRows
      .filter((row) => row.actorRole === "student" || row.eventType === "presence_heartbeat")
      .map((row) => {
        const dt = new Date(row.createdAt);
        const hhmmss = dt.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const date = dt.toISOString().slice(0, 10);
        return {
          id: String(row.id),
          station: row.approvalId ? `APP-${row.approvalId.slice(0, 6)}` : `PC-${String((row.id % 30) + 1).padStart(2, "0")}`,
          student: row.actorUserId,
          studentId: row.actorUserId,
          inTime: hhmmss,
          outTime: null,
          date,
          event: mapEventType(row.eventType),
        };
      });
    return mapped;
  }, [runaRows]);
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
              Events are minimized for governance: actor, risk, decision trace, and linked approval evidence.
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
          <div className={`${ADMIN_PANEL_CLASS} overflow-hidden`} style={ADMIN_PANEL_STYLE}>
            <div
              className="grid px-4 py-2 border-b border-[#1a2640] text-[#4a6080] uppercase tracking-widest"
              style={{
                fontSize: "8px",
                fontFamily: MONO,
                gridTemplateColumns: "56px 118px minmax(0,1fr) 84px 56px 88px 58px",
              }}
            >
              <span>ID</span>
              <span>Time</span>
              <span>Event</span>
              <span>Actor</span>
              <span>Risk</span>
              <span>Approval</span>
              <span>Conf</span>
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
                    gridTemplateColumns: "56px 118px minmax(0,1fr) 84px 56px 88px 58px",
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
                  <span className="text-[#c5d5ea] break-all" title={row.detail}>
                    {row.eventType}
                    {row.approverUserId ? ` · by ${row.approverUserId}` : ""}
                  </span>
                  <span className="text-[#4a6080] truncate" title={row.actorUserId}>{row.actorUserId}</span>
                  <span className="text-[#a06820]">{row.riskTier ?? "—"}</span>
                  <span className="text-[#2a3a55] truncate" title={row.approvalId ?? ""}>{row.approvalId ?? "—"}</span>
                  <span className="text-[#2a3a55]">{typeof row.confidenceScore === "number" ? row.confidenceScore.toFixed(2) : "—"}</span>
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
            <h1 className="text-[#c5d5ea]" style={{ fontSize: ADMIN_HEADER_TITLE_SIZE, lineHeight: 1.15 }}>
              Laboratory Attendance &amp;<br />Security Log
            </h1>
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
                fontSize: "12px",
                fontFamily: MONO,
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

      <div className="p-6">
        <div>
          <div className={`${ADMIN_PANEL_CLASS} overflow-x-auto overflow-y-hidden`} style={ADMIN_PANEL_STYLE}>
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
                gridTemplateColumns: "110px 1fr 130px 130px",
                background: "#0d1320",
                borderBottom: "1px solid #1a2640",
              }}
            >
              {["STATION", "STUDENT", "TIME", "EVENT"].map((col) => (
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
                  className="grid items-center px-5 py-4 border-b border-[#1a2640] hover:bg-[#162035] transition-colors"
                  style={{ gridTemplateColumns: "110px 1fr 130px 130px" }}
                >
                  {/* Station */}
                  <span style={{ color: "#7eb5f5", fontSize: "11px", fontFamily: MONO }}>{log.station}</span>

                  {/* Student */}
                  <div>
                    <p className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>{log.student}</p>
                    <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>{log.studentId}</p>
                  </div>

                  {/* Time */}
                  <div>
                    <span style={{ color: "#c5d5ea", fontSize: "9px", fontFamily: MONO }}>{log.inTime}</span>
                  </div>

                  {/* Event */}
                  <EventBadge event={log.event} />
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

      </>
      )}
    </div>
  );
}
