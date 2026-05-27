import { describe, expect, it } from "vitest";
import { ApprovalSchema, ProjectAnalysisSnapshotSchema, ProjectSchema, ResumeSnapshotSchema } from "./index";

const now = new Date().toISOString();

describe("@pcc/schemas", () => {
  it("validates a canonical project", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "project-1",
        workspaceId: "workspace-1",
        name: "Build PCC",
        slug: "build-pcc",
        status: "active",
        priority: "high",
        progress: 15,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }),
    ).not.toThrow();
  });

  it("rejects progress outside the canonical range", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "project-1",
        workspaceId: "workspace-1",
        name: "Broken progress",
        slug: "broken-progress",
        status: "active",
        priority: "high",
        progress: 101,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }),
    ).toThrow();
  });

  it("requires resume snapshots to contain a next exact step", () => {
    expect(() =>
      ResumeSnapshotSchema.parse({
        id: "resume-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        source: "manual",
        youStoppedHere: "Shell created",
        nextExactStep: "Wire persistence",
        activeBlockerIds: [],
        relevantAttachmentIds: [],
        relevantLocationIds: [],
        createdAt: now,
        updatedAt: now,
        version: 1,
      }),
    ).not.toThrow();
  });

  it("validates approval objects for AI controlled changes", () => {
    expect(
      ApprovalSchema.parse({
        id: "approval-1",
        workspaceId: "workspace-1",
        status: "pending",
        title: "Apply resume",
        summary: "AI drafted a resume update",
        risk: "medium",
        createdAt: now,
        updatedAt: now,
        version: 1,
      }).status,
    ).toBe("pending");
  });

  it("validates local folder analysis snapshots", () => {
    expect(() =>
      ProjectAnalysisSnapshotSchema.parse({
        id: "analysis-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        locationId: "location-1",
        createdAt: now,
        scanPolicyVersion: "v1",
        analysisVersion: "v1",
        status: "complete",
        summary: {
          detectedName: "PCC",
          likelyProjectType: "web_app",
          confidence: 0.8,
          shortSummary: "React project",
          statusSummary: "Ready for implementation",
        },
        repo: { isGitRepo: false, changedFiles: [], hasUncommittedChanges: false },
        stack: { detectedLanguages: ["TypeScript"], detectedFrameworks: ["React"], packageManagers: ["pnpm"], configFiles: [], scripts: [] },
        docs: { readmeFiles: ["README.md"], docsFolders: [], statusFiles: [], planningFiles: [], summarizedDocs: [] },
        files: { totalFilesSeen: 1, totalFilesScanned: 1, totalFilesSkipped: 0, importantFiles: [], recentFiles: [], todoMarkers: [] },
        risks: [],
        blockers: [],
        recommendedNextStep: "Run tests",
        assistantContextSummary: "React project with pnpm",
        warnings: [],
        skipped: [],
      }),
    ).not.toThrow();
  });
});
