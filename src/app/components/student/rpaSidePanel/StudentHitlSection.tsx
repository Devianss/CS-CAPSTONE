import { ChevronDown, Inbox, History, AlertTriangle } from "lucide-react";
import type { ApprovalRequest } from "../../../agentic/types";
import { RiskBadge } from "../../agentic/RiskBadge";
import { formatApprovalActionLabel, formatTimestamp, shortApprovalId } from "./formatters";
import { PANEL_MONO, sectionEyebrowClass, bodyMutedClass, bodyClass } from "./panelTokens";
import { detailsSummaryFocusClass, scrollDetailsPanelIntoView } from "./detailsAccessibility";

export interface StudentHitlSectionProps {
  pending: ApprovalRequest[];
  history: ApprovalRequest[];
}

function statusLabel(status: ApprovalRequest["status"]): string {
  switch (status) {
    case "pending":
      return "Awaiting staff";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "info_requested":
      return "More info requested";
    default:
      return status;
  }
}

export function StudentHitlSection({ pending, history }: StudentHitlSectionProps) {
  const showHistory = history.filter((h) => h.status !== "pending");
  const hasContent = pending.length > 0 || showHistory.length > 0;

  return (
    <section className="rounded-lg border border-[#1e2e48] bg-[#0d1626] px-3.5 py-3 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Inbox size={15} className="text-[#7eb5f5] shrink-0" strokeWidth={1.75} />
        <span className={sectionEyebrowClass}>Reviews (HITL)</span>
      </div>
      <p className={`${bodyMutedClass} mb-2.5`}>High-impact steps need staff approval; you cannot self-approve.</p>

      {!hasContent && (
        <p className={`${bodyClass} rounded-md border border-[#1a2640] bg-[#111d30] px-2.5 py-2`}>
          Nothing queued. Escalations from the assistant appear here.
        </p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[#e8a83a] flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <AlertTriangle size={13} className="shrink-0" strokeWidth={1.75} />
            Pending for staff
          </p>
          {pending.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border px-2.5 py-2 min-w-0"
              style={{ background: "#1a1510", borderColor: "#e8821a55" }}
            >
              <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                <span className="text-[#c5d5ea] text-[11px] font-medium leading-tight min-w-0 break-words">
                  {formatApprovalActionLabel(req)}
                </span>
                <span className="shrink-0 inline-flex">
                  <RiskBadge tier="high" compact />
                </span>
              </div>
              <p className="text-[#6a8098] text-[9px]" style={{ fontFamily: PANEL_MONO }}>
                {statusLabel(req.status)} · {shortApprovalId(req.id)} · {formatTimestamp(req.createdAt)}
              </p>
              <p className="text-[#8aa0c0] mt-1.5 text-[10px] leading-snug line-clamp-3 break-words">
                {req.action.reasoning}
              </p>
            </div>
          ))}
        </div>
      )}

      {showHistory.length > 0 && (
        <details
          className="group rounded-lg border border-[#1e2e48] bg-[#111d30] min-w-0"
          onToggle={scrollDetailsPanelIntoView}
        >
          <summary
            className={`flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2.5 text-[#c5d5ea] text-[10px] font-medium hover:bg-[#162035] rounded-lg [&::-webkit-details-marker]:hidden ${detailsSummaryFocusClass}`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <History size={14} className="text-[#7eb5f5] shrink-0" strokeWidth={1.75} />
              <span className="truncate min-w-0">
                Recent decisions ({showHistory.length})
              </span>
            </span>
            <ChevronDown
              size={16}
              className="text-[#4a6080] shrink-0 transition-transform group-open:rotate-180"
              strokeWidth={1.75}
            />
          </summary>
          <ul className="space-y-1.5 px-2.5 pb-2.5 border-t border-[#1a2640] pt-2 min-w-0">
            {showHistory.map((req) => (
              <li
                key={req.id}
                className="rounded-md border px-2 py-2 min-w-0"
                style={{ background: "#111d30", borderColor: "#1e2e48" }}
              >
                <span className="text-[#c5d5ea] text-[10px] leading-snug break-words">
                  {formatApprovalActionLabel(req)} —{" "}
                  <span
                    className={
                      req.status === "approved"
                        ? "text-[#6ecf8f] font-medium"
                        : req.status === "rejected"
                          ? "text-[#e88888] font-medium"
                          : "text-[#c5d5ea]"
                    }
                  >
                    {statusLabel(req.status)}
                  </span>
                </span>
                <span className="text-[#4a6080] block mt-0.5 text-[9px]" style={{ fontFamily: PANEL_MONO }}>
                  {formatTimestamp(req.decision?.decidedAt ?? req.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
