/**
 * Polls agent queue + audit log for the signed-in student.
 * Keeps renderer logic out of presentational components.
 */

import { useCallback, useEffect, useState } from "react";
import { listHistory, listPending } from "../../../agentic/approvalQueue";
import type { ApprovalRequest } from "../../../agentic/types";
import type { AuditRow } from "../../../agentic/types";
import { useElectron } from "../../../ipc/useElectron";

const POLL_MS = 5000;

export interface StudentRpaPanelData {
  pendingForStudent: ApprovalRequest[];
  recentApprovalHistory: ApprovalRequest[];
  recentAuditForStudent: AuditRow[];
  refresh: () => Promise<void>;
  lastUpdatedAt: number | null;
}

function sortHistoryForStudent(rows: ApprovalRequest[], studentId: string): ApprovalRequest[] {
  return rows
    .filter((r) => r.requesterId === studentId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
}

export function useStudentRpaPanelData(studentId: string): StudentRpaPanelData {
  const api = useElectron();
  const [pendingForStudent, setPendingForStudent] = useState<ApprovalRequest[]>([]);
  const [recentApprovalHistory, setRecentApprovalHistory] = useState<ApprovalRequest[]>([]);
  const [recentAuditForStudent, setRecentAuditForStudent] = useState<AuditRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const sid = studentId.trim();
    if (!sid) {
      setPendingForStudent([]);
      setRecentApprovalHistory([]);
      setRecentAuditForStudent([]);
      setLastUpdatedAt(Date.now());
      return;
    }

    try {
      const [pending, history, auditRows] = await Promise.all([
        listPending(),
        listHistory(60),
        api.audit.list(100),
      ]);

      const minePending = pending.filter((r) => r.requesterId === sid && r.status === "pending");
      setPendingForStudent(minePending);
      setRecentApprovalHistory(sortHistoryForStudent(history, sid));

      const mineAudit = (auditRows as AuditRow[])
        .filter((row) => row.actorUserId === sid && row.actorRole === "student")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12);
      setRecentAuditForStudent(mineAudit);
    } catch {
      // Non-fatal: browser stub or transient IPC failure
      setPendingForStudent([]);
      setRecentApprovalHistory([]);
      setRecentAuditForStudent([]);
    } finally {
      setLastUpdatedAt(Date.now());
    }
  }, [studentId, api]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  return {
    pendingForStudent,
    recentApprovalHistory,
    recentAuditForStudent,
    refresh,
    lastUpdatedAt,
  };
}
