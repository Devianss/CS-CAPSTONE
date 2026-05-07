/**
 * Shared formatting for RUNA governance audit rows (vault, HITL, assistant).
 */

export type RunaAuditCategory = "all" | "vault" | "hitl" | "assistant";

export interface RunaAuditRowShape {
  eventType: string;
  detail: string;
  eventDescription?: string;
}

export function safeParseAuditDetail(detail: string): Record<string, unknown> | null {
  const t = detail?.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
  try {
    const o = JSON.parse(t) as unknown;
    return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function detailString(d: Record<string, unknown>, key: string): string | undefined {
  const v = d[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function detailRelativePath(d: Record<string, unknown>): string | undefined {
  return (
    detailString(d, "relativePath") ??
    detailString(d, "fromRelative") ??
    detailString(d, "toRelative")
  );
}

/** Human-readable primary line for the RUNA audit grid. */
export function formatRunaEventTitle(row: RunaAuditRowShape): string {
  const desc = row.eventDescription?.trim();
  if (desc) return desc;

  const t = row.eventType;
  const d = safeParseAuditDetail(row.detail);

  if (t === "action_executed" || t === "action_hard_failed") {
    const actionType = d ? detailString(d, "actionType") : undefined;
    const message = d ? detailString(d, "message") : undefined;
    const status = d ? detailString(d, "status") : undefined;
    if (actionType && message) {
      const verb = t === "action_hard_failed" ? "Failed" : "Completed";
      return `${verb}: ${actionType.replace(/_/g, " ")} · ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}`;
    }
    if (actionType) {
      return `${t === "action_hard_failed" ? "Failed" : "Executed"}: ${actionType.replace(/_/g, " ")}${status ? ` (${status})` : ""}`;
    }
  }

  if (t === "action_proposed" || t === "action_approved" || t === "action_rejected" || t === "action_requested") {
    const aid = d ? detailString(d, "approvalId") : undefined;
    const at = d ? detailString(d, "actionType") : undefined;
    const parts = [t.replace(/_/g, " ")];
    if (at) parts.push(at.replace(/_/g, " "));
    if (aid) parts.push(`#${aid.slice(0, 8)}`);
    return parts.join(" · ");
  }

  if (t.startsWith("runa_files_")) {
    const rel = d ? detailRelativePath(d) : undefined;
    const op = t.replace(/^runa_files_/, "").replace(/_/g, " ");
    if (rel) return `Vault ${op}: ${rel}`;
    return `Vault: ${op}`;
  }

  if (t === "chat_request") return "Assistant: user message";
  if (t === "chat_response") return "Assistant: reply";
  if (t === "request_refused") return "Assistant: request refused";
  if (t === "tool_invoked") return "Assistant: tool invoked";

  return t.replace(/_/g, " ");
}

/** Secondary line: canonical type + short detail hint for tooltips / subtitle. */
export function formatRunaEventSubtitle(row: RunaAuditRowShape): string {
  const d = safeParseAuditDetail(row.detail);
  if (!d) return row.eventType;

  const keys = ["actionType", "relativePath", "message", "op", "approvalId"];
  const parts: string[] = [row.eventType];
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.length > 0 && v.length < 80) parts.push(`${k}=${v}`);
    else if (typeof v === "number") parts.push(`${k}=${v}`);
  }
  return parts.length > 1 ? parts.join(" · ") : row.eventType;
}

/** Which filter buckets this row belongs to (can be multiple). */
export function categorizeRunaRow(row: RunaAuditRowShape): RunaAuditCategory[] {
  const out = new Set<RunaAuditCategory>();
  const t = row.eventType.toLowerCase();

  if (t.startsWith("runa_files")) out.add("vault");

  if (
    t.startsWith("action_") ||
    t.includes("approval") ||
    t.includes("hitl") ||
    t.includes("quarantine") ||
    t.includes("file_scan") ||
    t.includes("url_blocked") ||
    t.includes("usb_")
  ) {
    out.add("hitl");
  }

  if (
    t.startsWith("chat_") ||
    t === "request_refused" ||
    t === "tool_invoked" ||
    t.includes("reminder") ||
    t.includes("integrity")
  ) {
    out.add("assistant");
  }

  const d = safeParseAuditDetail(row.detail);
  const at = d && typeof d.actionType === "string" ? d.actionType.toLowerCase() : "";
  if (at.startsWith("runa_read") || at.startsWith("runa_write") || at.startsWith("runa_delete") || at.startsWith("runa_move") || at.startsWith("runa_create")) {
    out.add("vault");
  }
  if (
    at &&
    (at.includes("hitl") ||
      at.includes("escalation") ||
      at.includes("quarantine") ||
      at.includes("blocklist") ||
      at.includes("lock") ||
      at.includes("terminate") ||
      at.includes("wipe"))
  ) {
    out.add("hitl");
  }

  if (out.size === 0) return [];
  return Array.from(out);
}

export function runaRowMatchesFilter(row: RunaAuditRowShape, filter: RunaAuditCategory): boolean {
  if (filter === "all") return true;
  return categorizeRunaRow(row).includes(filter);
}

export function runaRowMatchesSearch(row: RunaAuditRowShape, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = [
    row.eventType,
    row.detail,
    row.eventDescription ?? "",
    formatRunaEventTitle(row),
    row.eventType.replace(/_/g, " "),
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}
