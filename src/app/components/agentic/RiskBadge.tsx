/**
 * RiskBadge.tsx
 *
 * The LOW / MED / HIGH chip used everywhere agent actions surface.
 * Visual style matches the RUNA console: monospace label, dark fill,
 * colored border + dot.
 *
 * Cross-reference: sprint/agentic-architecture.md §3.
 */

import type { RiskTier } from "../../agentic/types";

const MONO = "'Share Tech Mono', monospace";

interface RiskBadgeProps {
  tier: RiskTier;
  /** Optional reason string shown in the tooltip / aria-label. */
  reason?: string;
  /** Compact mode hides the label and shows just the dot. */
  compact?: boolean;
}

interface TierStyle {
  label: string;
  border: string;
  dot: string;
  text: string;
  bg: string;
}

const TIER_STYLES: Record<RiskTier, TierStyle> = {
  low: {
    label: "LOW",
    border: "#1e7a3e",
    dot: "#28b85f",
    text: "#7be39e",
    bg: "#0d2418",
  },
  medium: {
    label: "MED",
    border: "#a06820",
    dot: "#e8a83a",
    text: "#f0c66e",
    bg: "#241a08",
  },
  high: {
    label: "HIGH",
    border: "#a02a2a",
    dot: "#e05c6a",
    text: "#ffb1ba",
    bg: "#2a0c10",
  },
};

export function RiskBadge({ tier, reason, compact = false }: RiskBadgeProps) {
  const s = TIER_STYLES[tier];
  const ariaLabel = `Risk: ${s.label}${reason ? `. ${reason}` : ""}`;

  if (compact) {
    return (
      <span
        title={ariaLabel}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: s.dot,
          boxShadow: `0 0 4px ${s.dot}80`,
        }}
      />
    );
  }

  return (
    <span
      title={reason}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border tracking-widest uppercase"
      style={{
        borderColor: s.border,
        background: s.bg,
        color: s.text,
        fontSize: "9px",
        fontFamily: MONO,
        letterSpacing: "0.1em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          boxShadow: `0 0 3px ${s.dot}`,
        }}
      />
      <span>RISK · {s.label}</span>
    </span>
  );
}
