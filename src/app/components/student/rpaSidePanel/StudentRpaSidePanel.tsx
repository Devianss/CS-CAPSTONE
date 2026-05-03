/**
 * Student dashboard right rail: governed RPA context (environment, HITL, workflows, audit, policy).
 */

import { LabEnvironmentSection } from "./LabEnvironmentSection";
import { KioskBanner } from "./KioskBanner";
import { StudentHitlSection } from "./StudentHitlSection";
import { WorkflowStartersSection } from "./WorkflowStartersSection";
import { StudentAutomationLogSection } from "./StudentAutomationLogSection";
import { RpaGovernanceSection } from "./RpaGovernanceSection";
import { useStudentRpaPanelData } from "./useStudentRpaPanelData";
import { PANEL_SANS } from "./panelTokens";

export interface StudentRpaSidePanelProps {
  studentId: string;
  sessionRemainingLabel: string;
  vaultPathTail: string | null;
  vaultPathFull: string | null;
  kioskMode: boolean | null;
  canEditShortcuts: boolean;
  onWorkflowSelect: (prompt: string) => void;
}

export function StudentRpaSidePanel({
  studentId,
  sessionRemainingLabel,
  vaultPathTail,
  vaultPathFull,
  kioskMode,
  canEditShortcuts,
  onWorkflowSelect,
}: StudentRpaSidePanelProps) {
  const { pendingForStudent, recentApprovalHistory, recentAuditForStudent } = useStudentRpaPanelData(studentId);

  return (
    <aside
      className="flex flex-col border-l border-[#1a2640] min-h-0 min-w-0 max-w-[292px] flex-[0_1_292px] overflow-y-auto overflow-x-hidden py-5 px-4 gap-5"
      style={{ background: "#0a1120", fontFamily: PANEL_SANS }}
      aria-label="Runa automation and lab context"
    >
      <LabEnvironmentSection
        sessionRemainingLabel={sessionRemainingLabel}
        vaultPathTail={vaultPathTail}
        vaultPathFull={vaultPathFull}
        kioskMode={kioskMode}
        canEditShortcuts={canEditShortcuts}
      />

      {kioskMode === true && <KioskBanner />}

      <StudentHitlSection pending={pendingForStudent} history={recentApprovalHistory} />

      <WorkflowStartersSection onSelectPrompt={onWorkflowSelect} />

      <StudentAutomationLogSection rows={recentAuditForStudent} />

      <RpaGovernanceSection />
    </aside>
  );
}
