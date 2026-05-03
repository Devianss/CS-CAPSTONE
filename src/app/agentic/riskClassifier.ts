/**
 * agentic/riskClassifier.ts
 *
 * Deterministic risk classification for every agent action. Defense-friendly:
 * no opaque ML scoring. The rule table is in source so the panel can read it.
 *
 * Confidence-based escalation: AI-driven actions whose model confidence is
 * below CONFIDENCE_THRESHOLD escalate one tier (LOW→MEDIUM, MEDIUM→HIGH).
 * Threshold value justifiable as the industry-standard low-confidence cutoff.
 *
 * Unknown action types fail-safe to HIGH so a forgotten rule cannot
 * silently auto-execute a dangerous action.
 *
 * Cross-reference: sprint/agentic-architecture.md §3.
 */

import type { AgentAction, ActionType, RiskTier } from "./types";

export const CONFIDENCE_THRESHOLD = 0.7;

export const RISK_RULES: Readonly<Record<ActionType, RiskTier>> = {
  // LOW — read-only or session-scoped non-mutating
  chat_response: "low",
  audit_query: "low",
  view_policy: "low",
  health_check: "low",
  runa_create_folder: "low",
  runa_write_file: "low",
  runa_move_within_vault: "low",

  // MEDIUM — mutates non-critical state OR provides a recommendation
  recommend_action: "medium",
  draft_policy: "medium",
  mark_notification: "medium",

  // HIGH — mutates critical state, irreversible, or affects multiple users
  student_hitl_escalation: "high",
  wipe_terminal: "high",
  lock_cluster: "high",
  terminate_session: "high",
  quarantine_usb: "high",
  force_logout: "high",
  enforce_blocklist: "high",
};

export function classifyAction(action: AgentAction): RiskTier {
  const baseTier: RiskTier = RISK_RULES[action.type] ?? "high";

  if (action.confidence !== undefined && action.confidence < CONFIDENCE_THRESHOLD) {
    return escalateOneTier(baseTier);
  }
  return baseTier;
}

function escalateOneTier(tier: RiskTier): RiskTier {
  if (tier === "low") return "medium";
  return "high";
}

/**
 * Human-readable explanation of why a particular action was classified
 * the way it was. Used by the Approvals Queue card and audit reasoning.
 */
export function explainClassification(action: AgentAction): string {
  const baseTier = RISK_RULES[action.type] ?? "high";
  const finalTier = classifyAction(action);
  const escalated = baseTier !== finalTier;

  const baseRule = `Rule for "${action.type}" → ${baseTier.toUpperCase()}`;
  if (!escalated) {
    return baseRule;
  }
  return `${baseRule}; confidence ${action.confidence?.toFixed(2)} < ${CONFIDENCE_THRESHOLD} → escalated to ${finalTier.toUpperCase()}`;
}
