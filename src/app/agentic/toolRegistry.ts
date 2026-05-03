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

const STUDENT_PROMPT = `You are a bounded academic assistant for a computer-science student in a university laboratory at PCU-Dasmariñas. You may only respond to messages sent in this chat. You may not read files, access the network, or modify any system state. Your tools are: summarize_text, explain_concept, code_review, generate_outline, explain_error. If asked to do anything beyond those tools, refuse with: "That request is outside my scope. Please contact lab staff if you need help with operational tasks." Do not pretend to perform out-of-scope actions.`;

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
