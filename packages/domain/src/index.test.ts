import { describe, expect, it } from "vitest";
import {
  applyApproval,
  createAiResumeSuggestion,
  createBlocker,
  createInitialState,
  createProject,
  endSessionWithResume,
  getLatestAnalysisSnapshot,
  importLocalFolderProject,
  importFileToProject,
  rescanLocalFolderProject,
} from "./index";

describe("@pcc/domain", () => {
  it("runs the golden first slice through project, session, resume, and timeline", () => {
    let state = createInitialState("2026-05-27T00:00:00.000Z");
    state = createProject(state, {
      name: "Project Command Center",
      priority: "high",
      nextExactStep: "Build the shell",
    });
    const project = state.projects[0];

    state = endSessionWithResume(state, {
      projectId: project.id,
      summary: "Built the first app shell.",
      nextStep: "Wire local persistence.",
    });

    expect(state.projects[0].nextExactStep).toBe("Wire local persistence.");
    expect(state.resumeSnapshots).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.timelineEvents.map((event) => event.eventType)).toContain("project.created");
    expect(state.timelineEvents.map((event) => event.eventType)).toContain("session.ended");
  });

  it("creates blockers and marks the project blocked", () => {
    let state = createInitialState();
    state = createProject(state, { name: "Blocked project" });
    state = createBlocker(state, {
      projectId: state.projects[0].id,
      title: "Waiting for API keys",
      severity: "high",
    });

    expect(state.blockers[0].status).toBe("open");
    expect(state.projects[0].status).toBe("blocked");
  });

  it("requires approval before applying AI resume updates", () => {
    let state = createInitialState();
    state = createProject(state, { name: "Assistant project" });
    state = createAiResumeSuggestion(state, {
      projectId: state.projects[0].id,
      youStoppedHere: "Shell is done",
      nextExactStep: "Review approval UI",
    });

    expect(state.resumeSnapshots).toHaveLength(0);
    expect(state.approvals[0].status).toBe("pending");

    state = applyApproval(state, state.approvals[0].id);
    expect(state.resumeSnapshots[0].nextExactStep).toBe("Review approval UI");
    expect(state.approvals[0].status).toBe("applied");
    expect(state.auditLogs[0].action).toBe("apply_resume_snapshot");
  });

  it("imports files once and records duplicate attempts", () => {
    let state = createInitialState();
    state = createProject(state, { name: "Files project" });
    const projectId = state.projects[0].id;

    state = importFileToProject(state, {
      projectId,
      originalName: "brief.pdf",
      sizeBytes: 42,
      mimeType: "application/pdf",
      category: "docs",
      hash: "same",
    });
    state = importFileToProject(state, {
      projectId,
      originalName: "brief.pdf",
      sizeBytes: 42,
      mimeType: "application/pdf",
      category: "docs",
      hash: "same",
    });

    expect(state.attachments).toHaveLength(1);
    expect(state.timelineEvents[0].eventType).toBe("attachment.duplicate_detected");
  });

  it("imports local folder analysis as project, location, and immutable snapshot", () => {
    let state = createInitialState("2026-05-27T00:00:00.000Z");
    const result = importLocalFolderProject(state, makeDraft("C:/work/pcc", "pcc"), "2026-05-27T00:00:01.000Z");
    state = result.state;

    expect(result.duplicate).toBe(false);
    expect(state.projects[0].origin).toBe("local_folder_import");
    expect(state.projects[0].status).toBe("active");
    expect(state.locations[0].accessMode).toBe("read_only");
    expect(state.projectAnalysisSnapshots).toHaveLength(1);
    expect(getLatestAnalysisSnapshot(state, result.projectId)?.summary.detectedName).toBe("pcc");
    expect(state.auditLogs.map((log) => log.action)).toContain("folder_import_completed");
  });

  it("does not silently duplicate the same local folder and rescans with a new snapshot", () => {
    let state = createInitialState();
    const first = importLocalFolderProject(state, makeDraft("C:/work/pcc", "pcc"));
    state = first.state;
    const second = importLocalFolderProject(state, makeDraft("C:/work/pcc/", "pcc"));
    expect(second.duplicate).toBe(true);
    expect(second.state.projects).toHaveLength(1);

    state = rescanLocalFolderProject(state, first.projectId, makeDraft("C:/work/pcc", "pcc-updated"));
    expect(state.projectAnalysisSnapshots).toHaveLength(2);
    expect(getLatestAnalysisSnapshot(state, first.projectId)?.summary.detectedName).toBe("pcc-updated");
  });
});

function makeDraft(folderPath: string, name: string) {
  return {
    folderPath,
    projectName: name,
    projectDescription: "Detected project",
    currentFocus: "web app detected",
    nextExactStep: "Run tests",
    warnings: [],
    skipped: [],
    analysis: {
      scanPolicyVersion: "local-folder-import-v1",
      analysisVersion: "project-analysis-v1",
      status: "complete" as const,
      summary: {
        detectedName: name,
        likelyProjectType: "web_app" as const,
        confidence: 0.9,
        shortSummary: "Detected project",
        statusSummary: "web app detected",
      },
      repo: { isGitRepo: false, changedFiles: [], hasUncommittedChanges: false },
      stack: { detectedLanguages: ["TypeScript"], detectedFrameworks: ["React"], packageManagers: ["pnpm"], configFiles: [], scripts: [] },
      docs: { readmeFiles: ["README.md"], docsFolders: [], statusFiles: [], planningFiles: [], summarizedDocs: [] },
      files: { totalFilesSeen: 1, totalFilesScanned: 1, totalFilesSkipped: 0, importantFiles: [], recentFiles: [], todoMarkers: [] },
      risks: [],
      blockers: [],
      recommendedNextStep: "Run tests",
      assistantContextSummary: "Detected project",
      warnings: [],
      skipped: [],
    },
  };
}
