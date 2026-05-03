/**
 * agentic/toolRegistry.ts
 *
 * Hard-coded tool whitelists per role. The agent's surface area is bounded
 * by what's in this file — there is no dynamic tool discovery. Adding a
 * tool requires editing this file and the corresponding handler in
 * main.ts executeAction() dispatcher.
 *
 * Cross-reference: sprint/agentic-architecture.md §4.
 */

import type { AgentContext, AgentRole, ToolDefinition } from "./types";

export const STUDENT_TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "summarize_text",
    label: "Summarize text",
    riskTier: "low",
    description: "Summarize a passage you paste in.",
    systemPromptHint: "Provide a 3-sentence summary preserving the key claims.",
  },
  {
    id: "explain_concept",
    label: "Explain a concept",
    riskTier: "low",
    description: "Explain an academic or computer-science concept.",
    systemPromptHint: "Explain plainly with one short example.",
  },
  {
    id: "code_review",
    label: "Review code",
    riskTier: "low",
    description: "Comment on pasted code.",
    systemPromptHint: "Focus on correctness and readability; no rewrites.",
  },
  {
    id: "generate_outline",
    label: "Generate outline",
    riskTier: "low",
    description: "Outline an essay or paper.",
    systemPromptHint: "Produce a 3-level outline.",
  },
  {
    id: "explain_error",
    label: "Explain an error",
    riskTier: "low",
    description: "Explain a pasted error message and suggest a fix.",
    systemPromptHint: "Identify the cause and suggest a single concrete fix.",
  },
  {
    id: "runa_files_help",
    label: "Runa_Folder workspace",
    riskTier: "low",
    description:
      "Help organize or plan file layout under Runa_Folder (next to the Runa executable when packaged) — not arbitrary drives.",
    systemPromptHint:
      "Only discuss paths under the student's Runa_Folder session subfolder. Never suggest deleting system files or accessing other users' data.",
  },
  {
    id: "session_lab_help",
    label: "Session & lab focus",
    riskTier: "low",
    description: "Session timing, in-app reminders, and focus habits within lab rules.",
    systemPromptHint:
      "Do not claim to extend lab attendance or bypass web policy. Reminders are in-app only unless staff configures otherwise.",
  },
  {
    id: "lab_policy_faq",
    label: "Lab policy & Runa FAQ",
    riskTier: "low",
    description: "Explain what Runa can do, allowed tools, and how to request help from staff.",
    systemPromptHint: "Informational only — never claim to change blocklists or permissions yourself.",
  },
  {
    id: "integrity_guardrail",
    label: "Academic integrity",
    riskTier: "low",
    description: "Refusal path for disallowed completion / exam assistance.",
    systemPromptHint: "N/A",
  },
];

export const ADMIN_TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "summarize_audit",
    label: "Summarize audit log",
    riskTier: "low",
    description: "Summarize today's audit log.",
    systemPromptHint: "Highlight unusual events and recent escalations.",
  },
  {
    id: "explain_alert",
    label: "Explain a security alert",
    riskTier: "low",
    description: "Explain a specific alert in plain terms.",
    systemPromptHint: "Explain in plain terms; avoid jargon where possible.",
  },
  {
    id: "recommend_response",
    label: "Recommend a response",
    riskTier: "medium",
    description: "Recommend a response to an alert. Admin still actions.",
    systemPromptHint: "Provide 2-3 ranked options with brief rationale each.",
  },
  {
    id: "draft_policy",
    label: "Draft policy update",
    riskTier: "medium",
    description: "Draft a website blocklist or session-policy update.",
    systemPromptHint: "Provide a specific, copy-pasteable draft entry.",
  },
  {
    id: "propose_action",
    label: "Propose action (HITL)",
    riskTier: "high",
    description: "Queue a state-mutating action for HITL approval.",
    systemPromptHint:
      "Describe the proposed action and rationale. You may not execute directly; the request will be queued.",
  },
];

const STUDENT_PROMPT = `You are Runa, a bounded productivity assistant for a CS student in the PCU-Dasmariñas computer laboratory (English only).

Scope: (1) Academic Q&A, drafting help, code review, outlines, and error explanations from what the student pastes. (2) File organization guidance and safe automation only under Runa_Folder beside the Runa app (per-session subfolders in dev: under app userData) — never other users' directories or system paths. (3) Session and focus guidance using in-app reminders; you cannot extend official lab time, change attendance, or alter network/blocklist policy. (4) Lab policy and Runa usage — informational only; students add their own .exe/.lnk shortcuts in the UI; direct students to lab tech for access changes.

High-risk or external actions (e.g. sending email, submitting assignments to external systems, admin-level PC changes) are not executed autonomously — they require human-in-the-loop staff approval when proposed through the proper channel.

Academic integrity: do not complete entire graded assignments, exams, or impersonate the student's work. Help them learn: concepts, structure, short excerpts, and revision feedback.

If the assistant service is offline, tell the user clearly to try again when the lab network is available and to contact lab tech if the problem persists.

Tool ids exposed to the model: summarize_text, explain_concept, code_review, generate_outline, explain_error, runa_files_help, session_lab_help, lab_policy_faq, integrity_guardrail. Refuse out-of-scope requests briefly and point to lab staff when needed.`;

const ADMIN_PROMPT = `You are a bounded operational assistant for a laboratory administrator at PCU-Dasmariñas. You may summarize, recommend, and draft, but you may not directly execute any state-mutating action. Your tools are: summarize_audit, explain_alert, recommend_response, draft_policy, propose_action. All HIGH-risk actions you propose must be approved in the Approvals Queue, including by the same administrator you are speaking to. Do not pretend to have executed an action that you only proposed.`;

export function getAgentContext(role: AgentRole, userId: string): AgentContext {
  const tools = role === "admin" ? ADMIN_TOOLS : STUDENT_TOOLS;
  const systemPrompt = role === "admin" ? ADMIN_PROMPT : STUDENT_PROMPT;
  return {
    role,
    userId,
    availableTools: [...tools],
    systemPrompt,
  };
}

export function findTool(
  role: AgentRole,
  toolId: string,
): ToolDefinition | undefined {
  const tools = role === "admin" ? ADMIN_TOOLS : STUDENT_TOOLS;
  return tools.find((t) => t.id === toolId);
}
