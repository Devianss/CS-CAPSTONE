import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AlertTriangle, Users, Activity, RefreshCw, X, Usb, Shield, ChevronRight } from "lucide-react";
import { useNotificationContext } from "../providers/NotificationProvider";
import { useElectron } from "../ipc/useElectron";
import { useAdminLab } from "../context/AdminLabContext";
import { logAudit, proposeAction } from "../agentic/approvalQueue";
import {
  ATTENDANCE_BY_LAB,
  COMLAB_DEFINITIONS,
  COMLAB_IDS,
  buildMonitoringPcs,
  getComlab,
  type ComlabId,
} from "../data/comlabs";

const MONO = "'Space Mono', monospace";
const GROTESK = "'Space Grotesk', sans-serif";

type PCStatus = "active" | "idle" | "alert" | "offline";

const PC_STATUS_STYLE: Record<PCStatus, { bg: string; border: string; text: string }> = {
  active: { bg: "#162a50", border: "#3a6fff", text: "#7eb5f5" },
  idle: { bg: "#111d30", border: "#1e2e48", text: "#4a6080" },
  alert: { bg: "#3a1020", border: "#e05c6a", text: "#e05c6a" },
  offline: { bg: "#0d1320", border: "#1a2235", text: "#2a3a55" },
};

type UsbDevice = {
  vendor_id?: string;
  product_id?: string;
  manufacturer?: string | null;
  product?: string | null;
};

type MonitoringPc = { id: string; status: PCStatus };
type TimelineStatus = "pending" | "active" | "done";

interface UsbTimelineState {
  visible: boolean;
  deviceLabel: string;
  perceptionAt?: string;
  reasoningAt?: string;
  actionAt?: string;
  perception: TimelineStatus;
  reasoning: TimelineStatus;
  action: TimelineStatus;
  actionNote: string;
}

/** Stable baseline per lab — never recomputed on render. */
const STATIC_PCS_BY_LAB: Record<ComlabId, MonitoringPc[]> = Object.fromEntries(
  COMLAB_IDS.map((id) => [id, buildMonitoringPcs(getComlab(id))]),
) as Record<ComlabId, MonitoringPc[]>;

/** 0-based row indices toggled on manual refresh (deterministic demo). */
const REFRESH_TOGGLE_INDICES = [4, 11, 22];

export function LabMonitoringPanel() {
  const { pushToast } = useNotificationContext();
  const api = useElectron();
  const { labId, setLabId } = useAdminLab();
  const [activeTab, setActiveTab] = useState<ComlabId>(labId);

  useEffect(() => {
    setActiveTab(labId);
  }, [labId]);

  const labDef = getComlab(activeTab);
  const [pcsBase, setPcsBase] = useState<MonitoringPc[]>(() => [...STATIC_PCS_BY_LAB[labId]]);
  const [idleOverrideIds, setIdleOverrideIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPcsBase([...STATIC_PCS_BY_LAB[activeTab]]);
    setIdleOverrideIds(new Set());
  }, [activeTab]);

  const pcs = useMemo(
    () => pcsBase.map((p) => (idleOverrideIds.has(p.id) ? { ...p, status: "idle" as const } : p)),
    [pcsBase, idleOverrideIds],
  );
  const [sessionSecs, setSessionSecs] = useState(96 * 60);
  const [showAlert, setShowAlert] = useState(true);
  const [expandedPC, setExpandedPC] = useState<string | null>(null);

  useEffect(() => {
    const alertPc = pcs.find((p) => p.status === "alert");
    setExpandedPC(alertPc?.id ?? pcs[0]?.id ?? null);
  }, [pcs]);
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [actorId, setActorId] = useState("admin");
  const [urlInput, setUrlInput] = useState("");
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [urlCheckBusy, setUrlCheckBusy] = useState(false);
  const [usbTimeline, setUsbTimeline] = useState<UsbTimelineState>({
    visible: false,
    deviceLabel: "",
    perception: "pending",
    reasoning: "pending",
    action: "pending",
    actionNote: "Waiting for USB event.",
  });
  const seenUsbSignaturesRef = useRef<Set<string>>(new Set());
  const usbBaselineReadyRef = useRef(false);

  const refreshBlockedDomains = useCallback(async () => {
    const rows = await api.security.listBlockedDomains();
    setBlockedDomains(rows);
  }, [api]);

  useEffect(() => {
    void api.session.get().then((s) => {
      if (s?.userId) setActorId(s.userId);
    });
    void refreshBlockedDomains();
  }, [api, refreshBlockedDomains]);

  const orchestrateUsbInsertion = useCallback(
    async (device: UsbDevice) => {
      const label = `${device.manufacturer ?? "Unknown"} ${device.product ?? "USB"}`.trim();
      const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setUsbTimeline({
        visible: true,
        deviceLabel: label,
        perception: "done",
        reasoning: "active",
        action: "pending",
        perceptionAt: now,
        reasoningAt: now,
        actionNote: "Scanning USB and preparing proposal...",
      });
      pushToast(`USB detected: ${label}`, "warn");
      await logAudit({
        eventType: "usb_inserted",
        detail: JSON.stringify({ device }),
        actorUserId: actorId,
        actorRole: "admin",
        riskTier: "low",
      });

      const scan = await api.python.call<{ ok?: boolean; devices?: UsbDevice[]; count?: number }>(
        "/scan-usb",
        {},
        { method: "POST", timeoutMs: 30_000 },
      );
      const scanAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      await logAudit({
        eventType: "usb_scan_complete",
        detail: JSON.stringify({ ok: scan.ok, deviceLabel: label }),
        actorUserId: actorId,
        actorRole: "admin",
        riskTier: "medium",
      });

      const proposal = await proposeAction(
        {
          type: "quarantine_usb",
          scope: "session",
          reversible: true,
          payload: {
            device: label,
            product: device.product ?? "unknown",
            vendor: device.vendor_id ?? "unknown",
            reason: "removable_media_policy",
          },
          confidence: 0.85,
          reasoning: `USB orchestrator policy triggered for newly inserted device: ${label}`,
        },
        actorId,
        "admin",
        { scanResult: scan.data ?? null, sourceAlert: "usb_inserted" },
      );

      const actionAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (proposal.autoExecuted) {
        setUsbTimeline((prev) => ({
          ...prev,
          reasoning: "done",
          action: "done",
          reasoningAt: scanAt,
          actionAt,
          actionNote: proposal.result.message,
        }));
      } else {
        setUsbTimeline((prev) => ({
          ...prev,
          reasoning: "done",
          action: "done",
          reasoningAt: scanAt,
          actionAt,
          actionNote: `HIGH risk queued for HITL approval: ${proposal.request.id.slice(0, 8)}…`,
        }));
      }
    },
    [actorId, api, pushToast],
  );

  useEffect(() => {
    const t = setInterval(() => setSessionSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pollUsb = async () => {
      const r = await api.python.call<{ ok?: boolean; devices?: UsbDevice[]; count?: number }>(
        "/usb-list",
        undefined,
        { method: "GET", timeoutMs: 8000 },
      );
      if (cancelled) return;
      if (r.ok && r.data && typeof r.data === "object" && (r.data as { ok?: boolean }).ok !== false) {
        const body = r.data as { devices?: UsbDevice[]; count?: number };
        const nextDevices = Array.isArray(body.devices) ? body.devices : [];
        setUsbDevices(nextDevices);
        setUsbError(null);
        const signatures = nextDevices.map((d) => `${d.vendor_id ?? "?"}:${d.product_id ?? "?"}:${d.product ?? "?"}`);
        if (!usbBaselineReadyRef.current) {
          seenUsbSignaturesRef.current = new Set(signatures);
          usbBaselineReadyRef.current = true;
          return;
        }
        const seen = seenUsbSignaturesRef.current;
        const inserted = nextDevices.filter((d) => {
          const sig = `${d.vendor_id ?? "?"}:${d.product_id ?? "?"}:${d.product ?? "?"}`;
          return !seen.has(sig);
        });
        seenUsbSignaturesRef.current = new Set(signatures);
        if (inserted.length > 0) {
          void orchestrateUsbInsertion(inserted[0]);
        }
      } else {
        setUsbDevices([]);
        setUsbError(r.error ?? "unreachable");
      }
    };
    void pollUsb();
    const id = setInterval(() => void pollUsb(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [api, orchestrateUsbInsertion]);

  const evaluateUrl = useCallback(async () => {
    const raw = urlInput.trim();
    if (!raw) return;
    setUrlCheckBusy(true);
    try {
      const check = await api.security.checkUrl(raw);
      if (check.ok && check.blocked) {
        pushToast(`Blocked by policy: ${check.domain}`, "warn");
        await logAudit({
          eventType: "url_blocked",
          detail: JSON.stringify({ domain: check.domain, source: "local_policy" }),
          actorUserId: actorId,
          actorRole: "admin",
          riskTier: "high",
        });
        return;
      }

      const analysis = await api.python.call<{ ok?: boolean; suspicious?: boolean; score?: number; url?: string }>(
        "/analyze-url",
        { url: raw },
        { method: "POST", timeoutMs: 30_000 },
      );
      if (!analysis.ok || !analysis.data) {
        pushToast(`URL check failed: ${analysis.error ?? "unknown error"}`, "error");
        return;
      }
      const body = analysis.data;
      if (body.suspicious) {
        const domain = check.domain || raw;
        const proposal = await proposeAction(
          {
            type: "enforce_blocklist",
            scope: "lab",
            reversible: true,
            payload: {
              domain,
              url: raw,
              score: body.score ?? 0.9,
              reason: "suspicious_url_detected",
            },
            confidence: 0.8,
            reasoning: `URL analyzer marked this URL suspicious (${body.score ?? 0}). Propose adding ${domain} to blocklist.`,
          },
          actorId,
          "admin",
        );
        if (proposal.autoExecuted) {
          pushToast(`Blocklist enforced for ${domain}`, "warn");
        } else {
          pushToast(`Suspicious URL queued for approval: ${proposal.request.id.slice(0, 8)}…`, "warn");
        }
      } else {
        pushToast("URL is currently allowed by analyzer/policy", "success");
      }
      await refreshBlockedDomains();
    } finally {
      setUrlCheckBusy(false);
    }
  }, [actorId, api, pushToast, refreshBlockedDomains, urlInput]);

  const mm = Math.floor(sessionSecs / 60);
  const ss = sessionSecs % 60;
  const sessionStr = `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;

  const prof = {
    name: labDef.professorName,
    subject: labDef.subject,
    timeRange: labDef.timeRange,
  };
  const attendance = ATTENDANCE_BY_LAB[activeTab];
  const activeCount = pcs.filter((p) => p.status === "active").length;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1320", fontFamily: GROTESK }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 h-12 border-b border-[#1a2640] shrink-0"
        style={{ background: "#0a1020" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[#c5d5ea]" style={{ fontSize: "13px", fontFamily: MONO }}>RUNA · LAB MONITORING</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ac77e]" />
            <span className="text-[#4ac77e] tracking-widest" style={{ fontSize: "8px", fontFamily: MONO }}>SYSTEM SYNCHRONIZED</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center text-[#4a6080] hover:text-[#7eb5f5]"
            onClick={() => {
              setPcsBase((prev) =>
                prev.map((pc, i) => {
                  if (!REFRESH_TOGGLE_INDICES.includes(i)) return pc;
                  if (pc.status !== "active" && pc.status !== "idle") return pc;
                  return { ...pc, status: pc.status === "active" ? "idle" : "active" };
                }),
              );
              pushToast("Lab monitoring data refreshed", "info");
            }}
            title="Refresh lab data"
          >
            <RefreshCw size={13} />
          </button>
          <span className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
            {new Date().toLocaleTimeString("en-GB")} UTC
          </span>
        </div>
      </div>

      {/* COMLAB tabs */}
      <div className="flex border-b border-[#1a2640]" style={{ background: "#0f1828" }}>
        {COMLAB_DEFINITIONS.map((lab) => (
          <button
            key={lab.id}
            type="button"
            onClick={() => {
              setActiveTab(lab.id);
              setLabId(lab.id);
            }}
            className="flex items-center gap-2 px-5 py-3 transition-all"
            style={{
              borderBottom: activeTab === lab.id ? "2px solid #3a6fff" : "2px solid transparent",
              color: activeTab === lab.id ? "#7eb5f5" : "#4a6080",
            }}
          >
            <span style={{ fontSize: "12px", fontFamily: MONO }}>{lab.label}</span>
            {lab.incidentCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: "#e05c6a20", color: "#e05c6a", fontSize: "8px", fontFamily: MONO }}
              >
                {lab.incidentCount} INCIDENT
              </span>
            )}
            {lab.incidentCount === 0 && (
              <span style={{ color: "#4ac77e", fontSize: "8px", fontFamily: MONO }}>
                {lab.healthLabel}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">
        {/* Session hero */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-xl border"
          style={{ background: "#111d30", borderColor: "#1e2e48" }}
        >
          <div>
            <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>
              Currently Active Session · {labDef.label}
            </p>
            <p className="text-[#c5d5ea]" style={{ fontSize: "20px" }}>{prof.name}</p>
            <p className="text-[#4a6080]" style={{ fontSize: "11px", fontFamily: MONO }}>
              {prof.subject} &nbsp;·&nbsp; {prof.timeRange}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Session Time Left</p>
            <p className="text-[#c5d5ea] tabular-nums" style={{ fontSize: "36px", fontFamily: MONO, lineHeight: 1 }}>
              {sessionStr}
            </p>
            <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>END OF LAB PERIOD</p>
          </div>
          <div className="text-center">
            <p className="text-[#4a6080] tracking-widest uppercase mb-1" style={{ fontSize: "8px", fontFamily: MONO }}>Occupancy</p>
            <p className="text-[#c5d5ea]" style={{ fontSize: "28px", fontFamily: MONO, lineHeight: 1 }}>
              {activeCount}<span className="text-[#4a6080]" style={{ fontSize: "16px" }}>/{pcs.length}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-[#4a6080] tracking-widest uppercase mb-2" style={{ fontSize: "8px", fontFamily: MONO }}>Alert Level</p>
            <span
              className="px-4 py-1.5 rounded"
              style={{
                background: labDef.incidentCount > 0 ? "#e05c6a20" : "#4ac77e20",
                color: labDef.incidentCount > 0 ? "#e05c6a" : "#4ac77e",
                fontSize: "13px",
                fontFamily: MONO,
                border: `1px solid ${labDef.incidentCount > 0 ? "#e05c6a40" : "#4ac77e40"}`,
              }}
            >
              {labDef.healthLabel}
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border px-4 py-3 flex flex-wrap items-start gap-3"
          style={{ background: "#111d30", borderColor: "#1e2e48" }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Usb size={14} className="text-[#7eb5f5]" />
            <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>
              USB bus (sidecar)
            </span>
            <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
              refresh 5s
            </span>
          </div>
          {usbError ? (
            <p className="text-[#e8821a]" style={{ fontSize: "10px", fontFamily: MONO }}>
              {usbError}
            </p>
          ) : usbDevices.length === 0 ? (
            <p className="text-[#4a6080]" style={{ fontSize: "10px", fontFamily: MONO }}>
              No devices reported (pyusb optional).
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 m-0 p-0 list-none flex-1 min-w-0">
              {usbDevices.slice(0, 12).map((d, i) => (
                <li
                  key={`${d.vendor_id}-${d.product_id}-${i}`}
                  className="px-2 py-1 rounded border text-[#4a6080]"
                  style={{ borderColor: "#2a3a55", fontSize: "9px", fontFamily: MONO }}
                >
                  {(d.manufacturer ?? "?")} · {(d.product ?? "device")}{" "}
                  <span className="text-[#2a3a55]">
                    {d.vendor_id}/{d.product_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-[#e8821a]" />
            <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>
              URL policy enforcement
            </span>
          </div>
          <p className="text-[#4a6080] mb-3" style={{ fontSize: "10px", fontFamily: MONO }}>
            Checks local enforced blocklist first, then analyzer. Suspicious URLs queue `enforce_blocklist` via HITL.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded px-2 py-1.5 border outline-none"
              style={{
                background: "#0d1320",
                borderColor: "#1e2e48",
                color: "#c5d5ea",
                fontSize: "10px",
                fontFamily: MONO,
              }}
            />
            <button
              type="button"
              onClick={() => void evaluateUrl()}
              disabled={urlCheckBusy || !urlInput.trim()}
              className="px-3 py-1.5 rounded disabled:opacity-50"
              style={{ background: "#3a6fff", color: "#c5d5ea", fontSize: "10px", fontFamily: MONO }}
            >
              CHECK
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {blockedDomains.length === 0 ? (
              <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                No enforced blocked domains yet.
              </span>
            ) : (
              blockedDomains.map((domain) => (
                <span
                  key={domain}
                  className="px-2 py-1 rounded border"
                  style={{ borderColor: "#e05c6a50", color: "#e05c6a", fontSize: "9px", fontFamily: MONO }}
                >
                  {domain}
                </span>
              ))
            )}
          </div>
        </div>

        {usbTimeline.visible && (
          <div className="rounded-xl border p-4" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-[#7eb5f5]" />
              <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>
                USB orchestrator timeline
              </span>
              <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                {usbTimeline.deviceLabel}
              </span>
            </div>
            {(
              [
                { key: "perception", label: "Perception", at: usbTimeline.perceptionAt, status: usbTimeline.perception },
                { key: "reasoning", label: "Reasoning", at: usbTimeline.reasoningAt, status: usbTimeline.reasoning },
                { key: "action", label: "Action", at: usbTimeline.actionAt, status: usbTimeline.action },
              ] as const
            ).map((stage) => (
              <div key={stage.key} className="flex items-center gap-2 mb-2">
                <ChevronRight size={11} className="text-[#4a6080]" />
                <span className="text-[#c5d5ea]" style={{ fontSize: "10px" }}>
                  {stage.label}
                </span>
                <span className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
                  {stage.at ?? "--:--:--"}
                </span>
                <span
                  style={{
                    fontSize: "8px",
                    fontFamily: MONO,
                    color:
                      stage.status === "done"
                        ? "#4ac77e"
                        : stage.status === "active"
                          ? "#e8a83a"
                          : "#4a6080",
                  }}
                >
                  {stage.status.toUpperCase()}
                </span>
              </div>
            ))}
            <p className="mt-2 text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>
              {usbTimeline.actionNote}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Terminal Matrix */}
          <div className="col-span-2 rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Terminal Status Matrix</span>
              <div className="flex items-center gap-3">
                {(["active", "alert", "idle", "offline"] as PCStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ background: PC_STATUS_STYLE[s].bg, border: `1px solid ${PC_STATUS_STYLE[s].border}` }}
                    />
                    <span className="text-[#4a6080] capitalize" style={{ fontSize: "8px", fontFamily: MONO }}>{s}</span>
                  </div>
                ))}
                <span className="text-[#2a3a55]" style={{ fontSize: "8px", fontFamily: MONO }}>
                  Last Update: {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
              {pcs.map((pc) => {
                const style = PC_STATUS_STYLE[pc.status];
                const isExpanded = expandedPC === pc.id;
                const shouldAutoExpand = pc.status === "alert";

                return (
                  <div
                    key={pc.id}
                    className="rounded-md p-2 flex flex-col items-center gap-1 cursor-pointer hover:brightness-110 transition-all"
                    style={{
                      background: style.bg,
                      border: shouldAutoExpand ? `2px solid ${style.border}` : `1px solid ${style.border}`,
                      boxShadow: shouldAutoExpand ? `0 0 12px ${style.border}50` : "none",
                    }}
                    onClick={() => setExpandedPC(isExpanded ? null : pc.id)}
                  >
                    <svg width="18" height="14" viewBox="0 0 24 18" fill="none">
                      <rect x="0" y="0" width="24" height="14" rx="2" stroke={style.border} strokeWidth="1.5" fill={style.bg} />
                      <line x1="12" y1="14" x2="12" y2="18" stroke={style.border} strokeWidth="1.5" />
                      <line x1="8" y1="18" x2="16" y2="18" stroke={style.border} strokeWidth="1.5" />
                      {pc.status === "active" && <circle cx="12" cy="7" r="3" fill={style.border} opacity="0.6" />}
                      {pc.status === "alert" && <path d="M12 4 L14.5 9 H9.5 Z" fill={style.border} opacity="0.9" />}
                    </svg>
                    <span style={{ color: style.text, fontSize: "7px", fontFamily: MONO }}>{pc.id}</span>
                    {pc.status !== "idle" && pc.status !== "offline" && (
                      <span style={{ color: style.text, fontSize: "6px", fontFamily: MONO, textTransform: "uppercase" }}>
                        {pc.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Expanded PC Alert Details */}
            {expandedPC && pcs.find(p => p.id === expandedPC)?.status === "alert" && (
              <div className="mt-4 p-4 rounded-lg border" style={{ background: "#1a0d1a", borderColor: "#e05c6a50" }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-[#e05c6a] mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#e05c6a]" style={{ fontSize: "11px", fontFamily: MONO }}>
                      HIGH ALERT: {expandedPC}
                    </p>
                    <p className="text-[#a07080] mt-1.5" style={{ fontSize: "10px" }}>
                      Security engine detected unknown process "kill_linux_skills.exe" attempting to load a virtual drive.
                      Process has been quarantined by Runa security engine.
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <div>
                        <p className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>THREAT LEVEL</p>
                        <p className="text-[#e05c6a]" style={{ fontSize: "10px", fontFamily: MONO }}>CRITICAL</p>
                      </div>
                      <div>
                        <p className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>DETECTION TIME</p>
                        <p className="text-[#c5d5ea]" style={{ fontSize: "10px", fontFamily: MONO }}>14:26:08</p>
                      </div>
                      <div>
                        <p className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>STATUS</p>
                        <p className="text-[#e8821a]" style={{ fontSize: "10px", fontFamily: MONO }}>QUARANTINED</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedPC(null); }}
                    className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Attendance */}
          <div className="rounded-xl p-5 border" style={{ background: "#111d30", borderColor: "#1e2e48" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-[#3a6fff]" />
                <span className="text-[#c5d5ea]" style={{ fontSize: "13px" }}>Live Attendance</span>
              </div>
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: "#1e3055", color: "#7eb5f5", fontSize: "9px", fontFamily: MONO }}
              >
                {activeCount} ACTIVE
              </span>
            </div>
            <div className="space-y-3">
              {attendance.map((a, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border"
                  style={{ background: "#0d1320", borderColor: "#1e2e48" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#c5d5ea]" style={{ fontSize: "12px" }}>{a.name}</span>
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{ background: a.color + "20", color: a.color, fontSize: "8px", fontFamily: MONO }}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="text-[#4a6080]" style={{ fontSize: "9px", fontFamily: MONO }}>{a.id}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>{a.pc}</span>
                    <span className="text-[#2a3a55]" style={{ fontSize: "9px", fontFamily: MONO }}>{a.ip}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="block w-full text-center text-[#2a3a55] mt-3 bg-transparent border-0 cursor-pointer hover:text-[#4a6080] transition-colors"
              style={{ fontSize: "9px", fontFamily: MONO, letterSpacing: "0.12em" }}
              onClick={() => pushToast("Full attendance view — coming in production build", "info")}
            >
              VIEW FULL CLASS ({activeCount})
            </button>
          </div>
        </div>

        {/* System Flag Alert */}
        {labDef.incidentCount > 0 && showAlert && (
          <div
            className="rounded-xl p-5 border flex items-start gap-5"
            style={{ background: "#1a0d1a", borderColor: "#e05c6a50" }}
          >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#e05c6a20" }}>
              <AlertTriangle size={22} className="text-[#e05c6a]" />
            </div>
            <div className="flex-1">
              <p className="text-[#e05c6a]" style={{ fontSize: "12px", fontFamily: MONO }}>SYSTEM FLAG: TERMINAL PC-01</p>
              <p className="text-[#a07080] mt-1" style={{ fontSize: "11px" }}>
                Security engine detected unknown process "kill_linux_skills.exe" attempting to load an virtual drive.
                Process quarantined by Runa engine.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  className="px-4 py-1.5 rounded text-white transition-colors hover:opacity-90"
                  style={{ background: "#e05c6a", fontSize: "10px", fontFamily: MONO }}
                  onClick={() => {
                    pushToast("Terminal session wiped — audit log updated", "warn");
                    const target =
                      (expandedPC && pcs.find((p) => p.id === expandedPC)?.status === "alert" && expandedPC) ||
                      pcs.find((p) => p.status === "alert")?.id ||
                      null;
                    if (target) {
                      setIdleOverrideIds((prev) => new Set(prev).add(target));
                    }
                  }}
                >
                  WIPE TERMINAL
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded border transition-colors hover:bg-[#1e2e48]"
                  style={{ borderColor: "#2a3a55", color: "#4a6080", fontSize: "10px", fontFamily: MONO }}
                  onClick={() => {
                    pushToast("Alert acknowledged and logged", "info");
                    setShowAlert(false);
                  }}
                >
                  IGNORE OVERRIDE
                </button>
                <div className="ml-auto flex items-center gap-4">
                  <div>
                    <p className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>NETWORK USE</p>
                    <p className="text-[#c5d5ea]" style={{ fontSize: "10px", fontFamily: MONO }}>68.3 Kbps</p>
                  </div>
                  <div>
                    <p className="text-[#4a6080]" style={{ fontSize: "8px", fontFamily: MONO }}>PACKET LOSS</p>
                    <p className="text-[#e05c6a]" style={{ fontSize: "10px", fontFamily: MONO }}>8.43%</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAlert(false)}
              className="text-[#4a6080] hover:text-[#c5d5ea] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
