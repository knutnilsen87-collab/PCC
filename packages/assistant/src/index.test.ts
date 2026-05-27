import { describe, expect, it } from "vitest";
import { createInitialState, createProject } from "@pcc/domain";
import { coreAssistantTools, listCoreToolRegistrations, runAssistantCommand } from "./index";

describe("@pcc/assistant", () => {
  it("registers approval-gated mutation tools", () => {
    const resumeTool = coreAssistantTools.find((tool) => tool.id === "draft_resume_snapshot");
    const importTool = coreAssistantTools.find((tool) => tool.id === "import_file_to_active_project");

    expect(resumeTool?.approvalRequired).toBe("always");
    expect(resumeTool?.auditRequired).toBe(true);
    expect(importTool?.approvalRequired).toBe("always");
    expect(coreAssistantTools.find((tool) => tool.id === "rescan_active_project")?.approvalRequired).toBe("always");
    expect(coreAssistantTools.find((tool) => tool.id === "analyze_active_project")?.approvalRequired).toBe("never");
  });

  it("exports serializable tool registrations", () => {
    expect(listCoreToolRegistrations()[0]).not.toHaveProperty("inputSchema");
  });

  it("creates an approval instead of silently applying an AI resume draft", () => {
    let state = createInitialState();
    state = createProject(state, { name: "Assistant Flow" });

    const response = runAssistantCommand(
      state,
      {
        activeWorkspaceId: state.workspace.id,
        activeProjectId: state.projects[0].id,
        currentScreen: "project",
        userPermissions: ["project.read", "project.write"],
      },
      "draft resume: stopped after shell, next: wire approvals",
    );

    expect(response.mode).toBe("approve");
    expect(response.state?.approvals[0].status).toBe("pending");
    expect(response.state?.resumeSnapshots).toHaveLength(0);
  });
});
