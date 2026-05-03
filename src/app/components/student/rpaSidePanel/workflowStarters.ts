/**
 * Curated prompts for bounded RPA / assistant workflows.
 * Each starter maps to handlers or stub patterns in ProductivityAssistant.
 */

export interface WorkflowStarter {
  id: string;
  label: string;
  /** Full text inserted into the assistant composer. */
  prompt: string;
}

export const STUDENT_WORKFLOW_STARTERS: readonly WorkflowStarter[] = [
  {
    id: "session-time",
    label: "Session time left",
    prompt: "How much time do I have left on my session?",
  },
  {
    id: "reminder",
    label: "Set study reminder",
    prompt: "Remind me to save my work in 15 minutes",
  },
  {
    id: "runa-folder",
    label: "Create Runa_Folder",
    prompt: 'Create a folder named "LabWork" in my Runa vault',
  },
  {
    id: "concept",
    label: "Explain a concept",
    prompt: "Explain Big-O notation in one short paragraph with one example.",
  },
  {
    id: "outline",
    label: "Essay outline",
    prompt: "Give me a three-part outline for an essay on software engineering ethics.",
  },
  {
    id: "integrity",
    label: "What you won't do",
    prompt: "What kinds of academic help will you refuse? Summarize in bullets.",
  },
] as const;
