/**
 * Student-session host enforcement: Chrome policy probe via sidecar + USB quick scan.
 * Bounded autonomy: log → notify → optional Chrome termination on blocklist hits.
 */

import { execFile } from "child_process";
import type { ActorRole } from "./auditTypes";

type RiskTier = "low" | "medium" | "high";
type Role = "student" | "admin";

export type LogStructuredAudit = (row: {
  eventType: string;
  eventDescription: string;
  threatLevel: RiskTier;
  detail: string;
  actorUserId: string;
  actorRole: ActorRole;
  riskTier?: RiskTier;
}) => void;

type ChromeViolation = { url: string; host: string; matchedBlocked: string };

async function postSidecar<T>(port: number, path: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { default: axios } = await import("axios");
  const url = `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await axios.post(url, body, {
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
    });
    return { ok: true, data: res.data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function terminateChromeBestEffort(): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("taskkill", ["/IM", "chrome.exe", "/F", "/T"], { windowsHide: true }, () => resolve());
    } else if (process.platform === "darwin") {
      execFile("pkill", ["-9", "-x", "Google Chrome"], () => resolve());
    } else {
      execFile("pkill", ["-f", "chrome"], () => resolve());
    }
  });
}

type Session = { userId: string; role: Role; token: string; persistent: boolean; expiresAt: number } | null;

export function createStudentRuntimeEnforcement(opts: {
  pythonPort: number;
  pollIntervalMs: number;
  getSession: () => Session;
  getBlockedDomains: () => Promise<string[]>;
  logStructured: LogStructuredAudit;
  notifyTray: (title: string, body: string) => void;
}): { stop: () => void; runOnce: () => Promise<void> } {
  const { pythonPort, getSession, getBlockedDomains, logStructured, notifyTray } = opts;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const lastChromeKeys = new Set<string>();
  let lastUsbSignature = "";

  const runOnce = async () => {
    if (stopped) return;
    const session = getSession();
    if (!session || session.role !== "student") return;

    const uid = session.userId ?? "student";
    const actorRole = session.role as ActorRole;

    let blocked: string[] = [];
    try {
      blocked = await getBlockedDomains();
    } catch {
      blocked = [];
    }

    const chromeRes = blocked.length
      ? await postSidecar<{
          ok?: boolean;
          violations?: ChromeViolation[];
          detail?: string;
          error?: string;
        }>(pythonPort, "/enforcement/chrome-policy-check", { blockedDomains: blocked }, 20_000)
      : { ok: false as const };

    if (chromeRes.ok && chromeRes.data?.violations?.length) {
      for (const v of chromeRes.data.violations) {
        const key = `${v.matchedBlocked}|${v.host}`;
        if (lastChromeKeys.has(key)) continue;
        lastChromeKeys.add(key);
        if (lastChromeKeys.size > 32) lastChromeKeys.clear();

        const desc = `Blocked site visit in Chrome: ${v.host} (policy: ${v.matchedBlocked}). Browser terminated.`;
        logStructured({
          eventType: "browser_policy_enforcement",
          eventDescription: desc,
          threatLevel: "high",
          detail: JSON.stringify({
            source: "chrome_history_probe",
            url: v.url,
            host: v.host,
            matchedBlocked: v.matchedBlocked,
            action: "terminate_chrome",
          }),
          actorUserId: uid,
          actorRole,
          riskTier: "high",
        });
        notifyTray("RUNA policy enforcement", desc);
        await terminateChromeBestEffort();
      }
    }

    const usbRes = await postSidecar<{ ok?: boolean; report?: Record<string, unknown> }>(
      pythonPort,
      "/enforcement/usb-mount-scan",
      {},
      45_000,
    );
    if (usbRes.ok && usbRes.data?.report) {
      const rep = usbRes.data.report as {
        roots?: string[];
        filesScanned?: number;
        threats?: Array<{ path: string; kind: string; detail: string }>;
        clean?: boolean;
      };
      const roots = rep.roots ?? [];
      const threats = rep.threats ?? [];
      const hasUsbSignal =
        roots.length > 0 || (rep.filesScanned ?? 0) > 0 || threats.length > 0;
      if (hasUsbSignal) {
        const sig = `${roots.sort().join("|")}:${String(rep.filesScanned ?? 0)}:${threats.length}`;
        if (sig !== lastUsbSignature) {
          lastUsbSignature = sig;
          const threatLevel: RiskTier = threats.length ? "high" : "low";
          const desc =
            threats.length > 0
              ? `USB removable scan found ${threats.length} threat signal(s) on ${roots.join(", ") || "removable media"}.`
              : `USB removable scan completed (${rep.filesScanned ?? 0} file(s) on ${roots.length} mount(s)).`;
          logStructured({
            eventType: threats.length ? "usb_auto_scan_threat" : "usb_auto_scan_complete",
            eventDescription: desc,
            threatLevel,
            detail: JSON.stringify({
              source: "usb_mount_quick_scan",
              roots,
              filesScanned: rep.filesScanned ?? 0,
              threats,
              clean: rep.clean ?? true,
            }),
            actorUserId: uid,
            actorRole,
            riskTier: threatLevel,
          });
          if (threats.length) {
            notifyTray("RUNA USB scan", desc);
          }
        }
      }
    }
  };

  void runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, opts.pollIntervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
    runOnce,
  };
}
