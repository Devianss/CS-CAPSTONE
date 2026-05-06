import { ChevronDown, Shield } from "lucide-react";
import { sectionEyebrowClass, bodyMutedClass, bodyClass } from "./panelTokens";
import { detailsSummaryFocusClass, scrollDetailsPanelIntoView } from "./detailsAccessibility";

export function RpaGovernanceSection() {
  return (
    <details
      className="group rounded-lg border border-[#1e2e48] bg-[#0d1626] min-w-0"
      onToggle={scrollDetailsPanelIntoView}
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-[#111d30] rounded-lg [&::-webkit-details-marker]:hidden ${detailsSummaryFocusClass}`}
      >
        <span className="flex items-center gap-2">
          <Shield size={15} className="text-[#5a9eff] shrink-0" strokeWidth={1.75} />
          <span className={sectionEyebrowClass}>Risk &amp; fair use</span>
        </span>
        <ChevronDown
          size={16}
          className="text-[#4a6080] shrink-0 transition-transform group-open:rotate-180"
          strokeWidth={1.75}
        />
      </summary>

      <div className="border-t border-[#1a2640] px-3.5 pb-3 pt-2 space-y-3 min-w-0">
        <ul className={`${bodyClass} space-y-2`}>
          <li>
            <span className="text-[#6ecf8f] font-semibold">Low</span> — chat, vault helpers, session info.
          </li>
          <li>
            <span className="text-[#e8a83a] font-semibold">Medium</span> — drafts and recommendations (logged).
          </li>
          <li>
            <span className="text-[#e88888] font-semibold">High</span> — sensitive actions; HITL staff approval is required.
          </li>
        </ul>
        <div className="rounded-md border border-[#2a4060] bg-[#111d30] px-2.5 py-2">
          <p className={`${bodyMutedClass} font-semibold uppercase tracking-wider text-[8px] mb-1`}>
            Academic integrity
          </p>
          <p className={bodyClass}>
            Use Runa to learn and stay organized. Do not cheat or access others&apos; data. Ask lab staff when unsure.
          </p>
        </div>
      </div>
    </details>
  );
}
