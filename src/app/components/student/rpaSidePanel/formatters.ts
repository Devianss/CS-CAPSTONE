import type { ApprovalRequest } from "../../../agentic/types";

export function shortApprovalId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…`;
}

export function formatApprovalActionLabel(req: ApprovalRequest): string {
  const t = req.action.type.replace(/_/g, " ");
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAuditEventLabel(eventType: string): string {
  return eventType.replace(/_/g, " ");
}

export function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function truncateDetail(detail: string, max = 110): string {
  const t = detail.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
