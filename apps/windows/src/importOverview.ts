import {
  activeOpenBlockers,
  getLatestAnalysisSnapshot,
  getLatestResume,
  type AppState,
} from "@pcc/domain";
import type { Blocker, Project, ProjectAnalysisSnapshot, ResumeSnapshot } from "@pcc/schemas";

export interface SetupChecklistItem {
  label: string;
  complete: boolean;
}

export interface RecommendedAction {
  title: string;
  why: string;
  primaryCta: string;
  secondaryActions: string[];
}

export interface TodayProjectRow {
  project: Project;
  analysis?: ProjectAnalysisSnapshot;
  resume?: ResumeSnapshot;
  blockers: Blocker[];
  displayName: string;
  nextStep: string;
  hasAttention: boolean;
  status: "Blocked" | "Ready to continue" | "Needs setup" | "Needs next step";
}

export interface TodaySummary {
  activeCount: number;
  blockedCount: number;
  readyCount: number;
}

export function getImportedProjectDisplayStatus(input: {
  project: Project;
  analysis?: ProjectAnalysisSnapshot;
  resume?: ResumeSnapshot;
  openBlockers: Blocker[];
}): "Imported" | "Needs setup" | "Ready to resume" | "Blocked" {
  if (input.openBlockers.length > 0 || input.project.status === "blocked") return "Blocked";
  if (!input.analysis) return "Imported";
  if (!input.resume) return "Needs setup";
  return "Ready to resume";
}

export function getSetupChecklist(input: {
  analysis?: ProjectAnalysisSnapshot;
  resume?: ResumeSnapshot;
  nextStep?: string;
}): SetupChecklistItem[] {
  return [
    { label: "Folder imported", complete: Boolean(input.analysis) },
    { label: "Safe scan completed", complete: Boolean(input.analysis && input.analysis.status !== "failed") },
    { label: "Summary reviewed", complete: false },
    { label: "Resume snapshot created", complete: Boolean(input.resume) },
    { label: "Next step confirmed", complete: Boolean(input.resume?.nextExactStep || input.nextStep) },
  ];
}

export function getSetupProgressText(items: SetupChecklistItem[]): string {
  return `${items.filter((item) => item.complete).length} of ${items.length} complete`;
}

export function getRecommendedAction(input: {
  analysis?: ProjectAnalysisSnapshot;
  resume?: ResumeSnapshot;
}): RecommendedAction {
  if (!input.resume) {
    return {
      title: input.analysis?.recommendedNextStep ?? "Create a resume snapshot",
      why: "A resume snapshot turns the import analysis into a clear restart point for your next work session.",
      primaryCta: "Create resume snapshot",
      secondaryActions: ["Review project summary", "Generate Codex handoff", "Run deeper scan"],
    };
  }

  return {
    title: input.resume.nextExactStep,
    why: "Your restart context is ready. Confirm this next step, then continue from the project surface.",
    primaryCta: "Confirm next step",
    secondaryActions: ["Review project summary", "Generate Codex handoff", "Run deeper scan"],
  };
}

export function getAssistantQuickActions(project?: Project): string[] {
  if (project?.origin !== "local_folder_import") return [];
  return ["Create resume snapshot", "Summarize project", "Find next step", "Generate Codex handoff"];
}

export function getProjectDisplayName(project: Project, analysis?: ProjectAnalysisSnapshot): string {
  const manualDisplayName = (project as Project & { displayName?: string }).displayName?.trim();
  if (manualDisplayName) return humanizeProjectName(manualDisplayName);
  const detectedName = analysis?.summary.detectedName?.trim();
  if (detectedName && detectedName.toLowerCase() !== "unknown") return humanizeProjectName(detectedName);
  return humanizeProjectName(project.name || "Untitled project");
}

export function buildTodayProjectRows(state: AppState): TodayProjectRow[] {
  return state.projects
    .filter((project) => project.status !== "archived")
    .map((project) => {
      const analysis = getLatestAnalysisSnapshot(state, project.id);
      const resume = getLatestResume(state, project.id);
      const blockers = activeOpenBlockers(state, project.id);
      const nextStep = resume?.nextExactStep ?? project.nextExactStep ?? analysis?.recommendedNextStep ?? "Define the next exact action.";
      const status =
        blockers.length || project.status === "blocked"
          ? "Blocked"
          : resume || project.nextExactStep
            ? "Ready to continue"
            : project.origin === "local_folder_import"
              ? "Needs setup"
              : "Needs next step";

      return {
        project,
        analysis,
        resume,
        blockers,
        displayName: getProjectDisplayName(project, analysis),
        nextStep,
        hasAttention: blockers.length > 0 || Boolean(analysis?.warnings.length) || analysis?.status === "partial" || !resume || !project.nextExactStep,
        status,
      };
    });
}

export function getTodaySummary(rows: TodayProjectRow[]): TodaySummary {
  return {
    activeCount: rows.filter((row) => row.project.status === "active").length,
    blockedCount: rows.filter((row) => row.blockers.length > 0 || row.project.status === "blocked").length,
    readyCount: rows.filter((row) => row.status === "Ready to continue" && row.blockers.length === 0).length,
  };
}

export function getTodayRecommendation(rows: TodayProjectRow[]): TodayProjectRow | undefined {
  return (
    rows.find((row) => row.blockers.length > 0 || row.project.status === "blocked") ??
    rows.find((row) => row.resume) ??
    rows.find((row) => row.project.nextExactStep || row.analysis?.recommendedNextStep) ??
    [...rows].sort((left, right) => projectSortTime(right.project) - projectSortTime(left.project))[0]
  );
}

export function humanizeProjectName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Untitled project";

  const withoutNamespace = trimmed.replace(/^(com|org|io|net|app)\./i, "");
  const words = withoutNamespace
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const knownAcronyms = new Set(["api", "ui", "ux", "pcc", "pptv"]);
      if (knownAcronyms.has(word.toLowerCase())) return word.toUpperCase();
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  return words.join(" ") || "Untitled project";
}

function projectSortTime(project: Project): number {
  return Date.parse(project.lastActivityAt ?? project.lastOpenedAt ?? project.updatedAt ?? project.createdAt) || 0;
}

export function technicalScanDetailsDefaultOpen(): boolean {
  return false;
}

export function friendlyProjectSummary(analysis: ProjectAnalysisSnapshot): string {
  const stack = analysis.stack.detectedFrameworks[0] ?? analysis.stack.detectedLanguages[0] ?? "project";
  const docs = analysis.docs.readmeFiles.length ? "documentation was found" : "documentation still needs a look";
  const next = analysis.recommendedNextStep ? ` The next useful step is: ${analysis.recommendedNextStep}` : "";
  return `Project Command Center found a ${stack} ${analysis.summary.likelyProjectType.replace(/_/g, " ")} and ${docs}.${next}`;
}
