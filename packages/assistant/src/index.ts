import type { AppState, ResumeDraftInput } from "@pcc/domain";
import { createAiResumeSuggestion, getLatestAnalysisSnapshot } from "@pcc/domain";
import type { AssistantToolRegistration } from "@pcc/schemas";
import { z } from "zod";

export type AssistantMode = "ask" | "draft" | "navigate" | "import" | "act" | "approve";

export interface AssistantResponse {
  mode: AssistantMode;
  text: string;
  state?: AppState;
  targetProjectId?: string;
  approvalId?: string;
}

export interface AssistantContext {
  activeWorkspaceId: string;
  activeProjectId?: string;
  currentScreen: string;
  userPermissions: string[];
}

export interface AssistantTool extends AssistantToolRegistration {
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  requiredContext?: string[];
  permission: string;
  timelineEvent?: string;
}

export const coreAssistantTools: AssistantTool[] = [
  {
    id: "search_workspace",
    name: "Search workspace",
    description: "Search projects, sessions, notes, blockers, decisions, files, and locations.",
    inputSchema: z.object({ query: z.string().min(1) }),
    outputSchema: z.object({ results: z.array(z.unknown()) }),
    permission: "workspace.read",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "open_project",
    name: "Open project",
    description: "Navigate to a project.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ projectId: z.string().min(1) }),
    permission: "project.read",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "explain_current_project",
    name: "Explain current project",
    description: "Summarize active project state.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ summary: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.read",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "draft_session_summary",
    name: "Draft session summary",
    description: "Draft a session summary without persistence.",
    inputSchema: z.object({ notes: z.string().min(1) }),
    outputSchema: z.object({ summary: z.string(), nextStep: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "draft_resume_snapshot",
    name: "Draft resume snapshot",
    description: "Draft an updated resume snapshot for review.",
    inputSchema: z.object({
      projectId: z.string().min(1),
      youStoppedHere: z.string().min(1),
      nextExactStep: z.string().min(1),
    }),
    outputSchema: z.object({ approvalId: z.string().min(1) }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "always",
    auditRequired: true,
    timelineEvent: "approval.created",
    moduleId: "core",
  },
  {
    id: "create_blocker",
    name: "Create blocker",
    description: "Create a blocker from direct user input.",
    inputSchema: z.object({ title: z.string().min(1), severity: z.string().optional() }),
    outputSchema: z.object({ blockerId: z.string().min(1) }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "sometimes",
    auditRequired: false,
    timelineEvent: "blocker.created",
    moduleId: "core",
  },
  {
    id: "import_file_to_active_project",
    name: "Import file to active project",
    description: "Confirm and attach dropped files to the active project.",
    inputSchema: z.object({ projectId: z.string().min(1), fileRef: z.string().min(1) }),
    outputSchema: z.object({ attachmentId: z.string().min(1) }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "always",
    auditRequired: false,
    timelineEvent: "attachment.imported",
    moduleId: "core",
  },
  {
    id: "import_local_project_folder",
    name: "Import local project folder",
    description: "Open a scoped folder picker and import the selected folder as a read-only project analysis.",
    inputSchema: z.object({}),
    outputSchema: z.object({ projectId: z.string().optional(), status: z.string() }),
    permission: "project.write",
    approvalRequired: "sometimes",
    auditRequired: true,
    timelineEvent: "project.imported_from_local_folder",
    moduleId: "core",
  },
  {
    id: "analyze_active_project",
    name: "Analyze active project",
    description: "Return structured analysis from the latest ProjectAnalysisSnapshot.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ summary: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.read",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "suggest_next_step_from_project_analysis",
    name: "Suggest next step from project analysis",
    description: "Suggest a draft next exact step based on the latest snapshot.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ nextStep: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.read",
    approvalRequired: "never",
    auditRequired: false,
    moduleId: "core",
  },
  {
    id: "generate_codex_handoff_from_active_project",
    name: "Generate Codex handoff from active project",
    description: "Draft a Codex handoff from project analysis. Export/save requires approval.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ handoff: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.read",
    approvalRequired: "sometimes",
    auditRequired: true,
    moduleId: "core",
  },
  {
    id: "rescan_active_project",
    name: "Rescan active project",
    description: "Request a read-only rescan of the active local folder.",
    inputSchema: z.object({ projectId: z.string().min(1) }),
    outputSchema: z.object({ status: z.string() }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "always",
    auditRequired: true,
    timelineEvent: "project.rescan_requested",
    moduleId: "core",
  },
  {
    id: "create_blocker_from_analysis_finding",
    name: "Create blocker from analysis finding",
    description: "Create a blocker from an analysis finding after approval.",
    inputSchema: z.object({ projectId: z.string().min(1), findingTitle: z.string().min(1) }),
    outputSchema: z.object({ blockerId: z.string().optional() }),
    requiredContext: ["active_project_id"],
    permission: "project.write",
    approvalRequired: "always",
    auditRequired: true,
    moduleId: "core",
  },
];

export function listCoreToolRegistrations(): AssistantToolRegistration[] {
  return coreAssistantTools.map(({ inputSchema, outputSchema, permission, requiredContext, timelineEvent, ...tool }) => tool);
}

export function explainCurrentProject(state: AppState, projectId?: string): string {
  if (!projectId) return "No active project is selected yet. Create or select a project first.";
  const project = state.projects.find((candidate) => candidate.id === projectId);
  if (!project) return "The active project no longer exists in local state.";
  const blockers = state.blockers.filter((blocker) => blocker.projectId === projectId && blocker.status !== "resolved");
  const resume = state.resumeSnapshots.find((candidate) => candidate.projectId === projectId);
  const analysis = getLatestAnalysisSnapshot(state, projectId);
  return [
    `${project.name} is ${project.status} at ${project.progress}% progress.`,
    project.currentFocus ? `Current focus: ${project.currentFocus}.` : undefined,
    project.nextExactStep ? `Next exact step: ${project.nextExactStep}.` : undefined,
    analysis ? `Analysis: ${analysis.summary.statusSummary}. Detected stack: ${analysis.stack.detectedFrameworks.join(", ") || "unknown"}.` : undefined,
    resume ? `Latest resume: ${resume.youStoppedHere}` : "No resume snapshot has been captured yet.",
    blockers.length ? `Open blockers: ${blockers.map((blocker) => blocker.title).join(", ")}.` : "No open blockers.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function runAssistantCommand(state: AppState, context: AssistantContext, rawInput: string): AssistantResponse {
  const input = rawInput.trim();
  const activeProject = state.projects.find((project) => project.id === context.activeProjectId);
  const lower = input.toLowerCase();

  if (!input) {
    return { mode: "ask", text: "Write a command or drop a file into the assistant." };
  }

  if (lower.includes("explain") || lower.includes("status") || lower.includes("forklar")) {
    return {
      mode: "ask",
      text: explainCurrentProject(state, context.activeProjectId),
    };
  }

  if ((lower.includes("next step") || lower.includes("neste steg") || lower.includes("foreslå")) && activeProject) {
    const analysis = getLatestAnalysisSnapshot(state, activeProject.id);
    return {
      mode: "draft",
      text: analysis?.recommendedNextStep
        ? `Suggested next step: ${analysis.recommendedNextStep}`
        : activeProject.nextExactStep
          ? `Suggested next step: ${activeProject.nextExactStep}`
          : "No project analysis is available yet. Import or rescan a folder first.",
    };
  }

  if ((lower.includes("handoff") || lower.includes("codex")) && activeProject) {
    const analysis = getLatestAnalysisSnapshot(state, activeProject.id);
    return {
      mode: "draft",
      text: analysis
        ? `Codex handoff draft: ${activeProject.name}. Status: ${analysis.summary.statusSummary}. Next: ${analysis.recommendedNextStep ?? activeProject.nextExactStep ?? "Review analysis"}. Important files: ${analysis.files.importantFiles.map((file) => file.path).join(", ") || "none detected"}.`
        : "No analysis snapshot is available for a Codex handoff yet.",
    };
  }

  if (lower.includes("rescan") && activeProject) {
    return {
      mode: "approve",
      text: "Rescan is available from the project analysis surface and stays read-only. Confirm there to create a new immutable snapshot.",
    };
  }

  if ((lower.includes("draft") || lower.includes("resume") || lower.includes("oppsummer")) && activeProject) {
    const draft: ResumeDraftInput = {
      projectId: activeProject.id,
      youStoppedHere: input,
      nextExactStep: inferNextStep(input, activeProject.nextExactStep),
      currentFocus: activeProject.currentFocus,
      confidence: 0.74,
    };
    const nextState = createAiResumeSuggestion(state, draft);
    const approval = nextState.approvals[0];
    return {
      mode: "approve",
      text: "I drafted a resume snapshot and placed it in approvals for review.",
      state: nextState,
      approvalId: approval.id,
    };
  }

  if ((lower.startsWith("open ") || lower.startsWith("åpne ")) && state.projects.length) {
    const query = input.replace(/^(open|åpne)\s+/i, "").toLowerCase();
    const target = state.projects.find((project) => project.name.toLowerCase().includes(query)) ?? state.projects[0];
    return {
      mode: "navigate",
      text: `Opening ${target.name}.`,
      targetProjectId: target.id,
    };
  }

  return {
    mode: "ask",
    text: activeProject
      ? `I can explain ${activeProject.name}, draft a resume update, open another project, or help import dropped files.`
      : "Create or select a project first, then I can help with project context.",
  };
}

function inferNextStep(input: string, fallback?: string): string {
  const nextMatch = input.match(/(?:next|neste|step|steg)\s*[:\-]\s*(.+)$/i);
  if (nextMatch?.[1]) return nextMatch[1].trim();
  return fallback ?? "Review the assistant draft and choose the next concrete action.";
}
