import { describe, expect, it } from "vitest";
import {
  getAssistantQuickActions,
  getImportedProjectDisplayStatus,
  getRecommendedAction,
  getSetupChecklist,
  getSetupProgressText,
  technicalScanDetailsDefaultOpen,
} from "./importOverview";
import type { Project, ProjectAnalysisSnapshot } from "@pcc/schemas";

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
});
