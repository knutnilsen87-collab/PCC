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

export function technicalScanDetailsDefaultOpen(): boolean {
  return false;
}

export function friendlyProjectSummary(analysis: ProjectAnalysisSnapshot): string {
  const stack = analysis.stack.detectedFrameworks[0] ?? analysis.stack.detectedLanguages[0] ?? "project";
  const docs = analysis.docs.readmeFiles.length ? "documentation was found" : "documentation still needs a look";
  const next = analysis.recommendedNextStep ? ` The next useful step is: ${analysis.recommendedNextStep}` : "";
  return `Project Command Center found a ${stack} ${analysis.summary.likelyProjectType.replace(/_/g, " ")} and ${docs}.${next}`;
}
