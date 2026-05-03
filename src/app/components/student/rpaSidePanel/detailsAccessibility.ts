import type { SyntheticEvent } from "react";

/** Scroll opened `<details>` panels into view inside a scrollable rail (short viewports). */
export function scrollDetailsPanelIntoView(ev: SyntheticEvent<HTMLDetailsElement>): void {
  const el = ev.currentTarget;
  if (!el.open) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

/** Shared focus style for disclosure controls in the side panel. */
export const detailsSummaryFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a6fff55] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1120] rounded-lg";
