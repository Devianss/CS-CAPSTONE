/**
 * ProductivityAssistant.tsx
 *
 * The bounded agentic chat panel. Same component, two modes (student
 * and admin) parameterized by the `role` prop. Per-mode tools and
 * system prompts come from agentic/toolRegistry.ts.
 *
 * Backend: Day 3 calls the Python sidecar `POST /ai-task` (Bedrock when
 * configured; labeled `local_fallback` otherwise). Keyword stub remains
 * the offline fallback and for `refused` paths.
 *
 * Risk classification: every response is classified before it renders.
 * If a response would mutate state (HIGH-risk request from admin),
 * we DO NOT execute — we route through proposeAction() which queues
 * the request in the Approvals Queue.
 *
 * Cross-reference: sprint/agentic-architecture.md §4.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Bot, User, ShieldAlert } from "lucide-react";
import type { AgentRole, RiskTier, ToolDefinition } from "../../agentic/types";
import { getAgentContext, findTool } from "../../agentic/toolRegistry";
import { classifyAction, explainClassification } from "../../agentic/riskClassifier";
import { proposeAction, logAudit } from "../../agentic/approvalQueue";
import { useElectron } from "../../ipc/useElectron";
import { RiskBadge } from "./RiskBadge";

const MONO = "'Share Tech Mono', monospace";
const GROTESK = "'Exo 2', sans-serif";

interface ProductivityAssistantProps {
  role: AgentRole;
  userId: string;
  /** Optional fixed-height container; defaults to flex-1 of parent. */
  height?: number | string;
}

interface ChatMessage {
  id: string;
  from: "user" | "assistant";
  text: string;
  ts: number;
  riskTier: RiskTier;
  toolUsed?: string;
  /** Set when the message represents a queued HIGH-risk proposal. */
  approvalId?: string;
  /** Set when the assistant refused an out-of-scope request. */
  refused?: boolean;
}

// ─────────────────────────────────────────────
//  Stub backend (Day 2 only — Day 3 replaces with /ai-task)
// ─────────────────────────────────────────────
interface StubResponse {
  text: string;
  toolUsed?: string;
  /** If set, this is a HIGH-risk proposal — route through proposeAction. */
  proposeActionType?:
    | "wipe_terminal"
    | "lock_cluster"
    | "terminate_session"
    | "quarantine_usb"
    | "force_logout"
    | "enforce_blocklist";
  refused?: boolean;
}

const REFUSAL_TEXT_STUDENT =
  'That request is outside my scope. I can only help with academic explanation, summarization, code review, outlines, and error explanations. Please contact lab staff if you need help with operational tasks.';

const REFUSAL_TEXT_ADMIN =
  'I cannot execute that action directly. I can summarize, recommend, draft, or propose actions for HITL review. State-mutating actions must go through the Approvals Queue.';

/**
 * Stub responder. Pattern-matches against simple keywords. Used as
 * fallback when the sidecar is down or for authoritative refusals.
 */
function stubRespond(prompt: string, role: AgentRole): StubResponse {
  const p = prompt.toLowerCase().trim();

  // ── Universal refusal triggers ──────────────────────────
  // Anything the agent could be tricked into doing that's clearly out-of-scope.
  if (/delete|format|erase|rm\s+-rf|drop\s+(table|database)/.test(p)) {
    return {
      text:
        role === "student" ? REFUSAL_TEXT_STUDENT : REFUSAL_TEXT_ADMIN,
      refused: true,
    };
  }

  if (role === "student") {
    if (/explain.*(big[\s-]?o|complexity|algorithm)/.test(p))
      return {
        text:
          "Big-O notation describes how an algorithm's runtime or space grows with input size. O(1) is constant — independent of n. O(n) is linear — doubles when n doubles. O(n²) is quadratic — quadruples when n doubles. Use it to compare algorithms at scale, not for small inputs where constants dominate.",
        toolUsed: "explain_concept",
      };
    if (/explain|what is|define/.test(p))
      return {
        text:
          "Here's a plain explanation: I'm a stub backend right now, so I'm pattern-matching your prompt to one of my five tools. Day 3 of the sprint replaces me with a real Bedrock-backed Claude call that can answer this properly. For now: try asking about Big-O, summarizing a passage, reviewing code, or outlining an essay.",
        toolUsed: "explain_concept",
      };
    if (/summari[sz]e|tldr|tl;dr/.test(p))
      return {
        text:
          "Stub summary: I'd compress your passage into a 3-sentence summary preserving the key claims. (Real LLM call lands on Day 3.)",
        toolUsed: "summarize_text",
      };
    if (/review|check|critique|feedback/.test(p))
      return {
        text:
          "Stub code review: I'd comment on correctness and readability of the snippet you paste. Most common issues I'd flag: unhandled error paths, missing null checks, off-by-one bounds, mutating shared state. (Real review lands on Day 3.)",
        toolUsed: "code_review",
      };
    if (/outline|essay|paper/.test(p))
      return {
        text:
          "Stub outline:\n  I. Introduction — context, thesis\n     A. Hook\n     B. Background\n  II. Body\n     A. Argument 1\n     B. Argument 2\n  III. Conclusion — recap, implication\n(Real outline generation lands on Day 3.)",
        toolUsed: "generate_outline",
      };
    if (/error|exception|stack trace|undefined/.test(p))
      return {
        text:
          "Stub error explanation: paste the exact error message and a few lines of context, and I'd identify the cause and suggest one concrete fix. (Real diagnosis lands on Day 3.)",
        toolUsed: "explain_error",
      };
    return {
      text:
        "I matched your prompt to my general 'explain' tool. Try a more specific phrasing — 'summarize this:', 'review this code:', 'outline an essay on X', or 'explain this error:'.",
      toolUsed: "explain_concept",
    };
  }

  // ── ADMIN MODE ──────────────────────────────────────────
  if (/lock.*(cluster|comlab|lab\s*0?8)/.test(p))
    return {
      text:
        "I cannot lock the cluster directly. This is a HIGH-risk action and must go through the Approvals Queue. I have queued the proposal for your review — see APPROVALS QUEUE in the sidebar.",
      proposeActionType: "lock_cluster",
    };
  if (/terminate.*session/.test(p))
    return {
      text:
        "I cannot terminate sessions directly. This is a HIGH-risk action; I have queued the proposal. Please review it in the Approvals Queue.",
      proposeActionType: "terminate_session",
    };
  if (/wipe.*(terminal|pc|workstation)/.test(p))
    return {
      text:
        "I cannot wipe a terminal directly. HIGH-risk action queued for HITL approval. Review in the Approvals Queue.",
      proposeActionType: "wipe_terminal",
    };
  if (/quarantine.*(usb|drive|removable)/.test(p))
    return {
      text:
        "I cannot quarantine USB devices directly. HIGH-risk action queued for approval.",
      proposeActionType: "quarantine_usb",
    };
  if (/block.*(url|website|domain)/.test(p))
    return {
      text:
        "Modifying the enforced blocklist is a HIGH-risk action. I have queued the proposal for your review.",
      proposeActionType: "enforce_blocklist",
    };
  if (/summari[sz]e.*audit|audit.*summary/.test(p))
    return {
      text:
        "Stub audit summary: in the past 30 minutes I observed N login events, M file scans, and K HITL approvals. The most notable event was the most recent action_proposed row. (Real Bedrock-backed summary lands on Day 3.)",
      toolUsed: "summarize_audit",
    };
  if (/explain.*alert|what.*alert/.test(p))
    return {
      text:
        "Stub alert explanation: I would parse the most recent alert_id from the audit log and explain the security context in plain terms. (Real explanation lands on Day 3.)",
      toolUsed: "explain_alert",
    };
  if (/recommend|response|action.*to.*(alert|incident)/.test(p))
    return {
      text:
        "Stub recommendation:\n  1. Quarantine — isolate affected device.\n  2. Investigate — review session and recent USB events.\n  3. Notify — contact the user via lab staff.\nI cannot execute any of these directly; the admin actions them. (Real recommendation lands on Day 3.)",
      toolUsed: "recommend_response",
    };
  if (/draft.*(policy|blocklist)/.test(p))
    return {
      text:
        "Stub draft: I would produce a copy-pasteable policy entry, e.g. `enforced_blocklist += { domain: 'example.com', reason: '...', added_by: <admin>, added_at: <now> }`. Apply via Settings → Web Governance.",
      toolUsed: "draft_policy",
    };
  return {
    text:
      "Stub admin response. Try asking me to summarize the audit log, explain an alert, recommend a response, draft a policy, or propose an action like 'lock the cluster' or 'terminate sessions'.",
    toolUsed: "summarize_audit",
  };
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
type AiTaskBody = { ok?: boolean; response?: string; source?: string; detail?: string };

export function ProductivityAssistant({ role, userId, height }: ProductivityAssistantProps) {
  const ctx = useMemo(() => getAgentContext(role, userId), [role, userId]);
  const electron = useElectron();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "assistant",
      text:
        role === "student"
          ? `Welcome. I'm a bounded academic assistant. Available tools: ${ctx.availableTools.map((t) => t.label).join(", ")}. What can I help you with?`
          : `Operational assistant ready. Available tools: ${ctx.availableTools.map((t) => t.label).join(", ")}. HIGH-risk proposals route through the Approvals Queue.`,
      ts: Date.now(),
      riskTier: "low",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text,
      ts: Date.now(),
      riskTier: "low",
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    await logAudit({
      eventType: "chat_request",
      detail: JSON.stringify({ prompt: text, role }),
      actorUserId: userId,
      actorRole: role,
      riskTier: "low",
    });

    const stub = stubRespond(text, role);

    if (stub.proposeActionType) {
      const proposeRes = await proposeAction(
        {
          type: stub.proposeActionType,
          scope: "lab",
          reversible: false,
          payload: { source: "admin_assistant", prompt: text },
          confidence: 0.85,
          reasoning: `Admin assistant proposing ${stub.proposeActionType} based on user prompt: "${text.slice(0, 80)}"`,
        },
        userId,
        role,
      );

      if (proposeRes.autoExecuted) {
        const tier = proposeRes.tier;
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            from: "assistant",
            text: stub.text,
            ts: Date.now(),
            riskTier: tier,
            toolUsed: "propose_action",
          },
        ]);
      } else {
        const id = proposeRes.request.id;
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            from: "assistant",
            text: `${stub.text}\n\nApproval ID: ${id.slice(0, 8)}…`,
            ts: Date.now(),
            riskTier: "high",
            toolUsed: "propose_action",
            approvalId: id,
          },
        ]);
      }
      setBusy(false);
      return;
    }

    let assistantText = stub.text;
    let toolUsed: string | undefined = stub.toolUsed;
    let refused = stub.refused;
    let sidecarSource: string | undefined;

    if (!refused) {
      const py = await electron.python.call<AiTaskBody>(
        "/ai-task",
        {
          prompt: text,
          system: ctx.systemPrompt,
          role,
          tools: ctx.availableTools.map((t) => t.id),
        },
        { method: "POST", timeoutMs: 60_000 },
      );
      if (py.ok && py.data && typeof py.data === "object") {
        const body = py.data as AiTaskBody;
        if (typeof body.response === "string" && body.response.trim().length > 0) {
          assistantText = body.response.trim();
          toolUsed = "ai_task";
          refused = false;
          sidecarSource = body.source;
        }
      } else if (!py.ok) {
        assistantText =
          stub.text +
          `\n\n_(Python sidecar unavailable${py.error ? `: ${py.error}` : ""} — keyword fallback.)_`;
      }
    }

    // Non-HITL response path: classify, log, render.
    const responseAction = {
      type: refused ? "chat_response" : (toolUsed ?? "chat_response"),
      scope: "self" as const,
      reversible: true,
      payload: { responseLength: assistantText.length },
      reasoning: refused
        ? "Out-of-scope request refused per role's tool whitelist"
        : `Assistant tool: ${toolUsed ?? "chat_response"}`,
    };
    const tier: RiskTier = classifyAction({
      ...responseAction,
      type: toolUsed && findTool(role, toolUsed)?.riskTier
        ? toolUsed
        : "chat_response",
    } as never) ?? "low";

    // The toolUsed id may not be in RISK_RULES (e.g. 'summarize_text' is
    // a tool id, not an action type). Fall back to looking up the tier
    // directly from the registry.
    const tierFromRegistry: RiskTier =
      toolUsed && findTool(role, toolUsed)
        ? (findTool(role, toolUsed) as ToolDefinition).riskTier
        : "low";
    const finalTier = refused ? "low" : tierFromRegistry;

    const reason = refused
      ? "Out-of-scope request — refused per role's tool whitelist"
      : explainClassification({ ...responseAction, type: "chat_response" });

    setMessages((m) => [
      ...m,
      {
        id: `a-${Date.now()}`,
        from: "assistant",
        text: assistantText,
        ts: Date.now(),
        riskTier: finalTier,
        toolUsed,
        refused,
      },
    ]);

    await logAudit({
      eventType: refused ? "request_refused" : "chat_response",
      detail: JSON.stringify({ tool: toolUsed ?? null, reason, sidecarSource }),
      actorUserId: "system",
      actorRole: "agent",
      riskTier: finalTier,
    });

    if (toolUsed && !refused) {
      await logAudit({
        eventType: "tool_invoked",
        detail: JSON.stringify({ tool: toolUsed, sidecarSource }),
        actorUserId: "system",
        actorRole: "agent",
        riskTier: finalTier,
      });
    }

    // Suppress unused-tier warning while keeping the variable for
    // possible future divergence between renderer and registry tiers.
    void tier;
    setBusy(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className="flex flex-col rounded-sm border border-[#1e2e48] overflow-hidden"
      style={{
        background: "#0f1828",
        height: height ?? "100%",
        fontFamily: GROTESK,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2e48]"
        style={{ background: "#111d30" }}
      >
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-[#7eb5f5]" />
          <span
            className="text-[#c5d5ea] tracking-widest uppercase"
            style={{ fontSize: "10px", fontFamily: MONO }}
          >
            Productivity Assistant · {role.toUpperCase()} MODE
          </span>
        </div>
        <span
          className="text-[#4a6080] tracking-widest uppercase"
          style={{ fontSize: "8px", fontFamily: MONO }}
        >
          Bounded · {ctx.availableTools.length} tools
        </span>
      </div>

      {/* Scope statement */}
      <div
        className="px-4 py-2 border-b border-[#1a2640]"
        style={{ background: "#0d1626" }}
      >
        <div
          className="flex items-start gap-2 text-[#4a6080]"
          style={{ fontSize: "10px" }}
        >
          <ShieldAlert size={11} className="mt-0.5 shrink-0 text-[#a06820]" />
          <p style={{ lineHeight: 1.4 }}>
            {role === "student"
              ? "I do not access your files or network. I only respond to messages you send in this chat. Tools available: "
              : "I summarize, recommend, and draft. I do not directly execute state-mutating actions; HIGH-risk proposals route through the Approvals Queue. Tools available: "}
            <span className="text-[#7eb5f5]">
              {ctx.availableTools.map((t) => t.label).join(" · ")}
            </span>
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ background: "#0f1828" }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-sm border px-3 py-2"
              style={{
                background: m.from === "user" ? "#1a2a44" : "#111d30",
                borderColor: m.from === "user" ? "#3a5a9a" : "#1e2e48",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {m.from === "user" ? (
                  <User size={10} className="text-[#7eb5f5]" />
                ) : (
                  <Bot size={10} className="text-[#7eb5f5]" />
                )}
                <span
                  className="text-[#4a6080] tracking-widest uppercase"
                  style={{ fontSize: "8px", fontFamily: MONO }}
                >
                  {m.from === "user" ? "YOU" : "ASSISTANT"}
                </span>
                <RiskBadge tier={m.riskTier} />
                {m.toolUsed && (
                  <span
                    className="text-[#4a6080]"
                    style={{ fontSize: "8px", fontFamily: MONO }}
                  >
                    · {m.toolUsed}
                  </span>
                )}
                {m.refused && (
                  <span
                    className="text-[#e05c6a]"
                    style={{ fontSize: "8px", fontFamily: MONO }}
                  >
                    · REFUSED
                  </span>
                )}
                {m.approvalId && (
                  <span
                    className="text-[#e8a83a]"
                    style={{ fontSize: "8px", fontFamily: MONO }}
                  >
                    · QUEUED
                  </span>
                )}
              </div>
              <div
                className="text-[#c5d5ea] whitespace-pre-wrap"
                style={{ fontSize: "12px", lineHeight: 1.45 }}
              >
                {m.text}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div
              className="rounded-sm border border-[#1e2e48] px-3 py-2"
              style={{ background: "#111d30" }}
            >
              <span
                className="text-[#4a6080] tracking-widest uppercase"
                style={{ fontSize: "9px", fontFamily: MONO }}
              >
                ASSISTANT THINKING
                <span className="inline-block animate-pulse ml-1">···</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="border-t border-[#1e2e48] p-3 flex items-end gap-2"
        style={{ background: "#0d1626" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            role === "student"
              ? "Ask about a concept, paste code for review, request an outline..."
              : "Summarize today's audit, explain an alert, propose an action..."
          }
          rows={2}
          disabled={busy}
          className="flex-1 rounded-sm px-3 py-2 text-[#c5d5ea] placeholder-[#2e4060] border outline-none resize-none"
          style={{
            background: "#0f1a2a",
            borderColor: "#1e2e48",
            fontSize: "12px",
            fontFamily: MONO,
          }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-sm tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
          style={{
            background: "#3a5a9a",
            color: "#c5d5ea",
            fontSize: "10px",
            fontFamily: MONO,
          }}
        >
          SEND <Send size={11} />
        </button>
      </div>
    </div>
  );
}
