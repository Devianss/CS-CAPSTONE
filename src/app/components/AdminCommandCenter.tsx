import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  Download,
  FileText,
  Inbox,
  LayoutGrid,
  Monitor,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Usb,
  Users,
} from "lucide-react";
import { animate } from "motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COMLAB_SECURITY_FEED, COMLAB_DEFINITIONS, getComlab } from "../data/comlabs";
import { useAdminLab } from "../context/AdminLabContext";
import { useElectron } from "../ipc/useElectron";
import { useNotificationContext } from "../providers/NotificationProvider";

const MONO = "'Share Tech Mono', monospace";
const GROTESK = "'Exo 2', sans-serif";
const BRAND = "'Orbitron', sans-serif";

const OCCUPANCY_DATA = [
  { lab: "COMLAB 08", occupied: 28, capacity: 40 },
  { lab: "COMLAB 09", occupied: 35, capacity: 40 },
  { lab: "COMLAB 10", occupied: 19, capacity: 40 },
  { lab: "COMLAB 11", occupied: 40, capacity: 40 },
];

const THREAT_DATA = [
  { name: "Clean", value: 109, fill: "#4ac77e" },
  { name: "Warnings", value: 8, fill: "#e8821a" },
  { name: "Threats", value: 3, fill: "#e05c6a" },
];

const SERVICES = [
  { name: "ClamAV Engine", status: "online" as const, icon: Shield },
  { name: "Python Sidecar", status: "online" as const, icon: Cpu },
  { name: "USB Monitor", status: "online" as const, icon: Usb },
  { name: "AWS Bedrock", status: "degraded" as const, icon: Cloud },
  { name: "SQLite DB", status: "online" as const, icon: Database },
];

type ServiceStatus = "online" | "degraded" | "offline";

const AUDIT_SEED = [
  { type: "login" as const, station: "PC-08-12", user: "STU-2204", msg: "Student session started", ago: 1 },
  { type: "scan" as const, station: "PC-09-04", user: "SYSTEM", msg: "USB scan completed — clean", ago: 4 },
  { type: "threat" as const, station: "PC-10-07", user: "SYSTEM", msg: "Malware signature detected", ago: 7 },
  { type: "lock" as const, station: "PC-08-03", user: "ADMIN", msg: "Station locked by admin", ago: 12 },
  { type: "login" as const, station: "PC-11-19", user: "STU-1987", msg: "Student session started", ago: 15 },
];

function formatAgo(minutes: number): string {
  if (minutes < 0.5) return "just now";
  if (minutes < 1) return "under 1 min ago";
  return `${Math.round(minutes)} min ago`;
}

function DashboardKPICard({
  label,
  value,
  delta,
  icon: Icon,
  color,
  animKey,
}: {
  label: string;
  value: number;
  delta: number;
  icon: typeof Users;
  color: string;
  animKey: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, animKey]);

  const up = delta > 0;
  const flat = delta === 0;

  return (
    <div
      className="rounded-[10px] p-5 border flex flex-col gap-3 min-h-0"
      style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}22` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {!flat && (
          <span
            className="tabular-nums shrink-0"
            style={{
              fontSize: "10px",
              fontFamily: MONO,
              color: up ? "#4ac77e" : "#e05c6a",
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="text-[#c5d5ea] tabular-nums" style={{ fontSize: "28px", fontFamily: MONO, lineHeight: 1 }}>
        {display}
      </div>
      <p className="text-[#4a6080] mt-auto" style={{ fontSize: "11px", fontFamily: GROTESK }}>
        {label}
      </p>
    </div>
  );
}

function statusPillStyle(status: ServiceStatus): { bg: string; fg: string; label: string } {
  if (status === "online") return { bg: "#4ac77e22", fg: "#4ac77e", label: "ONLINE" };
  if (status === "degraded") return { bg: "#e8821a22", fg: "#e8821a", label: "DEGRADED" };
  return { bg: "#e05c6a22", fg: "#e05c6a", label: "OFFLINE" };
}

function SystemHealthWidget({
  onHealthResult,
}: {
  onHealthResult: (ok: boolean | null) => void;
}) {
  const { python } = useElectron();
  const [rows, setRows] = useState(SERVICES);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await python.call<{ status?: string }>("/health", undefined, {
        method: "GET",
        timeoutMs: 4000,
      });
      const ok = !!(r.ok && r.data && (r.data as { status?: string }).status === "ok");
      onHealthResult(ok);
      setRows((prev) =>
        prev.map((s) =>
          s.name === "Python Sidecar"
            ? { ...s, status: ok ? ("online" as const) : ("offline" as const) }
            : s,
        ),
      );
    } catch {
      onHealthResult(null);
      setRows(SERVICES);
    }
  }, [python, onHealthResult]);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  return (
    <div
      className="rounded-[10px] p-5 border h-full flex flex-col gap-3 min-h-0"
      style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
    >
      <p className="text-[#c5d5ea]" style={{ fontSize: "13px", fontFamily: GROTESK }}>
        System Health
      </p>
      <div className="space-y-2.5 flex-1">
        {rows.map((s) => {
          const Icon = s.icon;
          const st = statusPillStyle(s.status);
          return (
            <div key={s.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon size={14} className="text-[#7eb5f5] shrink-0" />
                <span className="text-[#c5d5ea] truncate" style={{ fontSize: "11px", fontFamily: MONO }}>
                  {s.name}
                </span>
              </div>
              <span
                className="px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5"
                style={{ background: st.bg, color: st.fg, fontSize: "8px", fontFamily: MONO }}
              >
                {s.status === "online" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ac77e] motion-safe:animate-pulse" />
                )}
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FeedType = "login" | "scan" | "threat" | "lock";

function feedDot(type: FeedType): string {
  if (type === "login") return "#3a6fff";
  if (type === "scan") return "#4ac77e";
  if (type === "threat") return "#e05c6a";
  return "#e8821a";
}

function LiveAuditFeed() {
  const { toasts } = useNotificationContext();
  const [items, setItems] = useState(() =>
    AUDIT_SEED.map((r, i) => ({
      id: `seed-${i}`,
      type: r.type,
      station: r.station,
      user: r.user,
      msg: r.msg,
      agoMin: r.ago,
    })),
  );
  const prevToastId = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setItems((prev) => prev.map((x) => ({ ...x, agoMin: x.agoMin + 0.5 })));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const head = toasts[0];
    if (!head || head.id === prevToastId.current) return;
    prevToastId.current = head.id;
    setItems((prev) =>
      [
        {
          id: `toast-${head.id}`,
          type: "login" as FeedType,
          station: "—",
          user: "NOTIFY",
          msg: head.message,
          agoMin: 0,
        },
        ...prev,
      ].slice(0, 8),
    );
  }, [toasts]);

  return (
    <div
      className="rounded-[10px] p-5 border h-full flex flex-col gap-3 min-h-0"
      style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
    >
      <p className="text-[#c5d5ea]" style={{ fontSize: "13px", fontFamily: GROTESK }}>
        Live Audit Feed
      </p>
      <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
        {items.map((e) => (
          <div key={e.id} className="flex gap-3 items-start">
            <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: feedDot(e.type) }} />
            <div className="min-w-0 flex-1">
              <p className="text-[#c5d5ea]" style={{ fontSize: "11px" }}>
                {e.msg}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                <span className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>
                  {formatAgo(e.agoMin)}
                </span>
                <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                  {e.station}
                </span>
                <span className="text-[#7eb5f5]" style={{ fontSize: "9px", fontFamily: MONO }}>
                  {e.user}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECURITY_PREVIEW = COMLAB_SECURITY_FEED.slice(0, 3);
const levelColors: Record<string, string> = {
  secure: "#4ac77e",
  critical: "#e05c6a",
  system: "#4a6fa5",
};

export function AdminCommandCenter({
  onNavigate,
  pendingCount,
}: {
  onNavigate: (id: string) => void;
  pendingCount: number;
}) {
  const { labId, setLabId } = useAdminLab();
  const { pushToast } = useNotificationContext();
  const lab = getComlab(labId);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [kpiAnimKey, setKpiAnimKey] = useState(0);
  const [healthTick, setHealthTick] = useState(0);

  const onHealthResult = useCallback((_ok: boolean | null) => {
    setLastRefreshed(new Date());
  }, []);

  const handleRefresh = useCallback(() => {
    setKpiAnimKey((k) => k + 1);
    setHealthTick((t) => t + 1);
    setLastRefreshed(new Date());
  }, []);

  const kpiRows = useMemo(
    () =>
      [
        { label: "Active Sessions", value: 47, delta: 8, icon: Users, color: "#3a6fff" },
        { label: "PCs Online", value: 112, delta: 3, icon: Monitor, color: "#4ac77e" },
        { label: "Threats Detected", value: 3, delta: -1, icon: ShieldAlert, color: "#e05c6a" },
        { label: "Pending Approvals", value: pendingCount, delta: 0, icon: Inbox, color: "#e8821a" },
      ] as const,
    [pendingCount],
  );

  const modules: { id: string; label: string; icon: typeof Activity; warn?: boolean }[] = useMemo(
    () => [
      { id: "lab-monitoring", label: "Monitoring", icon: Activity },
      { id: "access-control", label: "Access", icon: ShieldCheck },
      { id: "audit-trails", label: "Audit", icon: FileText },
      { id: "assistant", label: "Assistant", icon: Bot },
      { id: "approvals", label: "Approvals", icon: Inbox, warn: pendingCount > 0 },
    ],
    [pendingCount],
  );

  const totalScans = THREAT_DATA.reduce((a, b) => a + b.value, 0);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      <div className="px-6 pt-5 pb-4 border-b border-[#1a2640]" style={{ background: "#0f1828" }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 lg:gap-4 min-w-0">
            <span
              className="tracking-widest uppercase shrink-0"
              style={{ fontSize: "13px", fontFamily: BRAND, color: "#7eb5f5" }}
            >
              RUNA COMMAND CENTER
            </span>
            <span className="text-[#4a6080] hidden sm:inline" style={{ fontSize: "10px", fontFamily: MONO }}>
              last refreshed: {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              title="Refresh health"
              onClick={handleRefresh}
              className="w-9 h-9 rounded-md border border-[#2a3a55] flex items-center justify-center text-[#7eb5f5] hover:bg-[#162035] transition-colors"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              title="Export log"
              onClick={() => pushToast("Export not available in demo build", "info")}
              className="w-9 h-9 rounded-md border border-[#2a3a55] flex items-center justify-center text-[#7eb5f5] hover:bg-[#162035] transition-colors"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#1a2640]">
          <span className="text-[#2a3a55] uppercase w-full sm:w-auto mb-1 sm:mb-0" style={{ fontSize: "8px", fontFamily: MONO }}>
            Focus lab
          </span>
          {COMLAB_DEFINITIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setLabId(c.id)}
              className="px-2.5 py-1 rounded border transition-colors"
              style={{
                fontFamily: MONO,
                fontSize: "9px",
                borderColor: labId === c.id ? "#3a6fff" : "#2a3a55",
                color: labId === c.id ? "#c5d5ea" : "#4a6080",
                background: labId === c.id ? "#162035" : "transparent",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onNavigate(m.id)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border transition-colors hover:bg-[#162035]"
              style={{
                borderColor: m.warn ? "#e05c6a55" : "#2a3a55",
                background: "#111d30",
                fontFamily: MONO,
                fontSize: "10px",
                color: m.warn ? "#e8a0a8" : "#c5d5ea",
              }}
            >
              <m.icon size={14} className={m.warn ? "text-[#e05c6a]" : "text-[#7eb5f5]"} />
              {m.label}
              {m.id === "approvals" && pendingCount > 0 && (
                <span
                  className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-white"
                  style={{ fontSize: "9px", background: "#e05c6a" }}
                >
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Row 1 — KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:col-span-3">
            {kpiRows.map((k) => (
              <DashboardKPICard key={k.label} {...k} animKey={kpiAnimKey} />
            ))}
          </div>

          {/* Row 2 left — occupancy (2 cols) */}
          <div
            className="rounded-[10px] p-5 border min-h-[240px] flex flex-col lg:col-span-2"
            style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
          >
            <p className="text-[#c5d5ea] mb-2" style={{ fontSize: "13px" }}>
              Lab Occupancy
            </p>
            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={OCCUPANCY_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,111,255,0.1)" vertical={false} />
                  <XAxis dataKey="lab" tick={{ fill: "#c5d5ea", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#c5d5ea", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(58,111,255,0.06)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as { lab: string; occupied: number; capacity: number };
                      return (
                        <div
                          className="rounded-md border px-2.5 py-1.5"
                          style={{ background: "#111d30", borderColor: "#1e2e48", fontSize: 11 }}
                        >
                          <div style={{ color: "#c5d5ea" }}>{label}</div>
                          <div style={{ color: "#7eb5f5", fontFamily: MONO }}>
                            {row.occupied}/{row.capacity} seats
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="occupied" fill="#3a6fff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" fill="rgba(58,111,255,0.15)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2 right — health */}
          <div key={healthTick} className="min-h-[240px]">
            <SystemHealthWidget onHealthResult={onHealthResult} />
          </div>

          {/* Row 3 left — threat donut */}
          <div
            className="rounded-[10px] p-5 border flex flex-col items-center min-h-[260px]"
            style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
          >
            <p className="text-[#c5d5ea] self-start mb-1" style={{ fontSize: "13px" }}>
              Threat Summary
            </p>
            <div className="w-full h-[160px] relative">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={THREAT_DATA}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={68}
                    stroke="none"
                  >
                    {THREAT_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        const cx = (viewBox as { cx?: number }).cx ?? 0;
                        const cy = (viewBox as { cy?: number }).cy ?? 0;
                        return (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={cx} y={cy - 6} fill="#c5d5ea" style={{ fontSize: 18, fontFamily: MONO }}>
                              {totalScans}
                            </tspan>
                            <tspan x={cx} y={cy + 12} fill="#4a6080" style={{ fontSize: 9, fontFamily: MONO }}>
                              scans
                            </tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2 w-full">
              {THREAT_DATA.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
                    {d.name} {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 right — live feed (2 cols) */}
          <div className="min-h-[260px] lg:col-span-2">
            <LiveAuditFeed />
          </div>
        </div>

        {/* Selected lab quick strip */}
        <div
          className="rounded-[10px] border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"
          style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}
        >
          <div className="min-w-0">
            <p className="text-[#4a6080] uppercase mb-0.5" style={{ fontSize: "8px", fontFamily: MONO }}>
              Selected lab
            </p>
            <p className="text-[#c5d5ea] truncate" style={{ fontSize: "13px" }}>
              <span className="font-semibold">{lab.label}</span>
              <span className="text-[#4a6080]"> · </span>
              {lab.subject}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("lab-monitoring")}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#3a6fff80] text-[#7eb5f5] hover:bg-[#1e2e48] transition-colors"
            style={{ fontSize: "10px", fontFamily: MONO }}
          >
            Open monitoring
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="rounded-[10px] border px-4 py-3 mt-4" style={{ background: "#1a2640", borderColor: "rgba(58,111,255,0.15)" }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>
              Recent activity
            </span>
            <button
              type="button"
              onClick={() => onNavigate("audit-trails")}
              className="text-[#7eb5f5] hover:underline shrink-0"
              style={{ fontSize: "9px", fontFamily: MONO }}
            >
              Full log in Audit →
            </button>
          </div>
          <ul className="space-y-2 m-0 p-0 list-none">
            {SECURITY_PREVIEW.map((ev, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#2a3a55] shrink-0 tabular-nums" style={{ fontSize: "9px", fontFamily: MONO }}>
                  {ev.time}
                </span>
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: levelColors[ev.level] }} />
                <span className="text-[#a0b0c0] min-w-0" style={{ fontSize: "10px" }}>
                  {ev.msg}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
