import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectSurface, formatAssistantResponse, shouldUseAssistantPanel, toCompactAssistantText } from "./App";
import type { Project, ProjectAnalysisSnapshot } from "@pcc/schemas";

const importedProject: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "ProPokerTV_Main",
  slug: "propokertv-main",
  status: "active",
  priority: "medium",
  progress: 10,
  origin: "local_folder_import",
  localFolderPath: "C:\\Projects\\ProPokerTV_Main",
  nextExactStep: "Review the skipped summary, then run a scoped rescan if the missing areas matter.",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  version: 1,
};

const analysis: ProjectAnalysisSnapshot = {
  id: "analysis-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  locationId: "location-1",
  createdAt: "2026-05-28T00:00:00.000Z",
  scanPolicyVersion: "v1",
  analysisVersion: "v1",
  status: "complete",
  summary: {
    detectedName: "pptv-web",
    likelyProjectType: "web_app",
    confidence: 0.8,
    shortSummary: "pptv-web appears to be a web app.",
    statusSummary: "web app detected; React, Vite stack; test script not detected; partial safe scan",
  },
  repo: { isGitRepo: false, changedFiles: [], hasUncommittedChanges: false },
  stack: {
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: ["React", "Vite"],
    packageManagers: ["pnpm"],
    configFiles: [],
    scripts: [],
  },
  docs: { readmeFiles: ["README.md"], docsFolders: [], statusFiles: [], planningFiles: [], summarizedDocs: [] },
  files: {
    totalFilesSeen: 20,
    totalFilesScanned: 12,
    totalFilesSkipped: 8,
    importantFiles: [{ path: "README.md", category: "docs", reason: "Primary project documentation" }],
    recentFiles: [],
    todoMarkers: [],
  },
  risks: [{ id: "risk-1", severity: "medium", title: "No test script detected", explanation: "Add or confirm the focused verification path." }],
  blockers: [],
  recommendedNextStep: "Create a resume snapshot",
  assistantContextSummary: "Safe scan complete.",
  warnings: [],
  skipped: [{ reason: "too_large", count: 8, examples: ["dist/app.js"] }],
};

describe("ProjectSurface", () => {
  it("renders imported local folder projects as the Project Profile screen", () => {
    const markup = renderToStaticMarkup(
      <ProjectSurface
        project={importedProject}
        resume={undefined}
        blockers={[]}
        attachments={[]}
        analysis={analysis}
        timeline={[]}
        sessionSummary=""
        sessionNextStep=""
        blockerTitle=""
        fileCategory="docs"
        approvals={[]}
        onSessionSummaryChange={vi.fn()}
        onSessionNextStepChange={vi.fn()}
        onEndSession={vi.fn()}
        onBlockerTitleChange={vi.fn()}
        onCreateBlocker={vi.fn()}
        onFileCategoryChange={vi.fn()}
        onImportFolder={vi.fn()}
        onRescan={vi.fn()}
        onCreateResumeFromAnalysis={vi.fn()}
        onAssistantQuickAction={vi.fn()}
        onProfileCommand={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(markup).toContain("Project Profile");
    expect(markup).toContain("ProPokerTV_Main");
    expect(markup).toContain("Current Focus");
    expect(markup).toContain("Next Action");
    expect(markup).not.toContain("Project imported:");
    expect(markup).not.toContain("Setup progress");
  });
});

describe("assistant presentation helpers", () => {
  it("routes long assistant responses to the right panel", () => {
    expect(shouldUseAssistantPanel("Short answer.")).toBe(false);
    expect(shouldUseAssistantPanel("Step 1. Review the project summary. Step 2. Create a resume snapshot. Step 3. Run the smoke test.")).toBe(true);
  });

  it("keeps compact results short", () => {
    const compact = toCompactAssistantText("A".repeat(200));
    expect(compact.length).toBeLessThanOrEqual(150);
    expect(compact.endsWith("...")).toBe(true);
  });

  it("formats assistant instructions as simple lines", () => {
    expect(formatAssistantResponse("Next step. Run the focused smoke test. Save the session.")).toContain("\n");
  });
});
