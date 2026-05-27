import { describe, expect, it } from "vitest";
import {
  buildTodayProjectRows,
  getAssistantQuickActions,
  getImportedProjectDisplayStatus,
  getProjectDisplayName,
  getRecommendedAction,
  getSetupChecklist,
  getSetupProgressText,
  getTodayRecommendation,
  getTodaySummary,
  humanizeProjectName,
  technicalScanDetailsDefaultOpen,
} from "./importOverview";
import { createInitialState } from "@pcc/domain";
import type { Blocker, Project, ProjectAnalysisSnapshot, ResumeSnapshot } from "@pcc/schemas";

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Imported app",
  slug: "imported-app",
  status: "active",
  priority: "medium",
  progress: 10,
  origin: "local_folder_import",
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  version: 1,
};

const analysis: ProjectAnalysisSnapshot = {
  id: "analysis-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  locationId: "location-1",
  createdAt: "2026-05-27T00:00:00.000Z",
  scanPolicyVersion: "v1",
  analysisVersion: "v1",
  status: "complete",
  summary: {
    detectedName: "Imported app",
    likelyProjectType: "web_app",
    confidence: 0.8,
    shortSummary: "A useful app.",
    statusSummary: "Ready for setup",
  },
  repo: { isGitRepo: false, changedFiles: [], hasUncommittedChanges: false },
  stack: { detectedLanguages: ["TypeScript"], detectedFrameworks: ["React"], packageManagers: ["pnpm"], configFiles: [], scripts: [] },
  docs: { readmeFiles: ["README.md"], docsFolders: [], statusFiles: [], planningFiles: [], summarizedDocs: [] },
  files: { totalFilesSeen: 5, totalFilesScanned: 4, totalFilesSkipped: 1, importantFiles: [], recentFiles: [], todoMarkers: [] },
  risks: [],
  blockers: [{ title: "No test script detected", evidence: ["package scripts"], confidence: 0.6 }],
  recommendedNextStep: "Create a resume snapshot",
  assistantContextSummary: "Ready for setup",
  warnings: [],
  skipped: [{ reason: "secret_denied", count: 1, examples: [".env"] }],
};

const blocker: Blocker = {
  id: "blocker-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  title: "Missing test command",
  severity: "high",
  status: "open",
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  version: 1,
};

const resume: ResumeSnapshot = {
  id: "resume-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  source: "assistant",
  youStoppedHere: "Imported and reviewed project.",
  nextExactStep: "Run the focused smoke test.",
  activeBlockerIds: [],
  relevantAttachmentIds: [],
  relevantLocationIds: [],
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  version: 1,
};

describe("import overview presentation", () => {
  it("does not show imported projects as blocked by default", () => {
    expect(getImportedProjectDisplayStatus({ project, analysis, resume: undefined, openBlockers: [] })).toBe("Needs setup");
  });

  it("keeps technical scan details collapsed by default", () => {
    expect(technicalScanDetailsDefaultOpen()).toBe(false);
  });

  it("builds setup checklist progress after import", () => {
    const checklist = getSetupChecklist({ analysis, nextStep: analysis.recommendedNextStep ?? undefined });
    expect(checklist.map((item) => item.label)).toContain("Safe scan completed");
    expect(getSetupProgressText(checklist)).toBe("3 of 5 complete");
  });

  it("returns a recommended next action after import", () => {
    expect(getRecommendedAction({ analysis }).primaryCta).toBe("Create resume snapshot");
  });

  it("returns assistant quick actions for imported projects", () => {
    expect(getAssistantQuickActions(project)).toEqual([
      "Create resume snapshot",
      "Summarize project",
      "Find next step",
      "Generate Codex handoff",
    ]);
  });

  it("humanizes technical project names", () => {
    expect(humanizeProjectName("com.unity.multiplayer.center")).toBe("Unity Multiplayer Center");
    expect(humanizeProjectName("pptv-web")).toBe("PPTV Web");
    expect(humanizeProjectName("my_private_repo")).toBe("My Private Repo");
    expect(humanizeProjectName("PCC")).toBe("PCC");
  });

  it("uses detected names for project display names", () => {
    const technicalProject = { ...project, name: "com.unity.multiplayer.center" };
    const detectedAnalysis = { ...analysis, summary: { ...analysis.summary, detectedName: "com.unity.multiplayer.center" } };
    expect(getProjectDisplayName(technicalProject, detectedAnalysis)).toBe("Unity Multiplayer Center");
  });

  it("builds Today rows with friendly names and status text", () => {
    const state = {
      ...createInitialState("2026-05-27T00:00:00.000Z"),
      projects: [{ ...project, name: "com.unity.multiplayer.center", nextExactStep: "Review setup" }],
      projectAnalysisSnapshots: [{ ...analysis, summary: { ...analysis.summary, detectedName: "com.unity.multiplayer.center" } }],
    };

    const rows = buildTodayProjectRows(state);
    expect(rows[0]?.displayName).toBe("Unity Multiplayer Center");
    expect(rows[0]?.status).toBe("Ready to continue");
    expect(getTodaySummary(rows)).toEqual({ activeCount: 1, blockedCount: 0, readyCount: 1 });
  });

  it("recommends blocked projects before resume-ready projects", () => {
    const blockedProject = { ...project, id: "blocked-project", name: "blocked.project", status: "active" as const };
    const readyProject = { ...project, id: "ready-project", name: "ready.project", status: "active" as const };
    const state = {
      ...createInitialState("2026-05-27T00:00:00.000Z"),
      projects: [readyProject, blockedProject],
      projectAnalysisSnapshots: [
        { ...analysis, id: "analysis-ready", projectId: "ready-project", summary: { ...analysis.summary, detectedName: "ready.project" } },
        { ...analysis, id: "analysis-blocked", projectId: "blocked-project", summary: { ...analysis.summary, detectedName: "blocked.project" } },
      ],
      resumeSnapshots: [{ ...resume, projectId: "ready-project" }],
      blockers: [{ ...blocker, projectId: "blocked-project" }],
    };

    const recommendation = getTodayRecommendation(buildTodayProjectRows(state));
    expect(recommendation?.project.id).toBe("blocked-project");
    expect(recommendation?.status).toBe("Blocked");
  });
});
