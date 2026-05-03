import { Zap } from "lucide-react";
import { STUDENT_WORKFLOW_STARTERS } from "./workflowStarters";
import { sectionEyebrowClass, bodyMutedClass } from "./panelTokens";

export interface WorkflowStartersSectionProps {
  onSelectPrompt: (prompt: string) => void;
}

export function WorkflowStartersSection({ onSelectPrompt }: WorkflowStartersSectionProps) {
  return (
    <section className="rounded-lg border border-[#1e2e48] bg-[#0d1626] px-3.5 py-3 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Zap size={15} className="text-[#7eb5f5] shrink-0" strokeWidth={1.75} />
        <span className={sectionEyebrowClass}>Quick prompts</span>
      </div>
      <p className={`${bodyMutedClass} mb-2`}>Fills the composer; edit, then Send.</p>
      <div className="flex flex-col gap-1.5">
        {STUDENT_WORKFLOW_STARTERS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onSelectPrompt(w.prompt)}
            className="text-left rounded-md border px-2.5 py-2 transition-colors border-[#2a4060] bg-[#111d30] text-[#c5d5ea] hover:bg-[#1a2f52] hover:border-[#3a5a8a] text-[10px] leading-snug min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a6fff55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1626]"
          >
            {w.label}
          </button>
        ))}
      </div>
    </section>
  );
}
