import { describe, expect, it } from "vitest";
import { createInitialState, importLocalFolderProject } from "@pcc/domain";
import { scanVirtualEntries } from "@pcc/local-fs";
import type { Project } from "@pcc/schemas";
import {
  WEB_DEMO_FALLBACK_LABEL,
  buildFolderNamedImportDraft,
  deriveProjectNameFromFolderPath,
  getFolderImportMode,
  makeUniqueProjectName,
  pickDesktopFolder,
} from "./localFolderImport";
import { getProjectDisplayName } from "./importOverview";

function projectWithName(name: string): Project {
  return {
    id: `project-${name}`,
    workspaceId: "workspace-1",
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    status: "active",
    priority: "medium",
    progress: 10,
    origin: "local_folder_import",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
    version: 1,
  };
}

describe("desktop local folder import", () => {
  it("uses native desktop folder selection when the desktop adapter exists", async () => {
    const selected = {
      folderPath: "C:\\Users\\Knut\\Projects\\bulkIMG",
      entries: [{ path: "README.md", kind: "file" as const, content: "# bulkIMG" }],
    };
    const target = {
      __PCC_DESKTOP__: {
        pickAndScanFolder: async () => selected,
      },
    };

    expect(getFolderImportMode(target)).toBe("desktop");
    await expect(pickDesktopFolder(target)).resolves.toEqual(selected);
  });

  it("keeps the browser fallback out of the primary desktop path", () => {
    expect(getFolderImportMode({})).toBe("web_demo");
    expect(WEB_DEMO_FALLBACK_LABEL).toBe("Web demo fallback — limited, does not retain folder access");
  });

  it("derives the default project name from the selected folder basename", () => {
    expect(deriveProjectNameFromFolderPath("C:\\Users\\Knut\\Projects\\bulkIMG")).toBe("bulkIMG");
    expect(deriveProjectNameFromFolderPath("/Users/knut/projects/pptv-web")).toBe("pptv-web");
  });

  it("falls back when the selected folder basename is unavailable", () => {
    expect(deriveProjectNameFromFolderPath("///")).toBe("Imported Project");
    expect(deriveProjectNameFromFolderPath("")).toBe("Imported Project");
  });

  it("adds a safe suffix for duplicate folder names", () => {
    expect(makeUniqueProjectName("bulkIMG", [projectWithName("bulkIMG")])).toBe("bulkIMG 2");
    expect(makeUniqueProjectName("bulkIMG", [projectWithName("bulkIMG"), projectWithName("bulkIMG 2")])).toBe("bulkIMG 3");
  });

  it("creates a project after a safe local scan and stores path separately from display name", () => {
    const scan = scanVirtualEntries("C:/Users/Knut/Projects/bulkIMG", [
      { path: "README.md", kind: "file", content: "# bulkIMG" },
      { path: "src", kind: "directory" },
    ]);
    const draft = buildFolderNamedImportDraft({
      folderPath: "C:/Users/Knut/Projects/bulkIMG",
      scan,
      existingProjects: [],
    });
    const result = importLocalFolderProject(createInitialState("2026-05-28T00:00:00.000Z"), draft, "2026-05-28T00:00:00.000Z");
    const importedProject = result.state.projects[0];

    expect(result.duplicate).toBe(false);
    expect(importedProject?.name).toBe("bulkIMG");
    expect(importedProject?.localFolderPath).toBe("C:/Users/Knut/Projects/bulkIMG");
    expect(result.state.locations[0]?.pathOrUrl).toBe("C:/Users/Knut/Projects/bulkIMG");
  });

  it("uses the derived folder name in sidebar/header display even when technical detection differs", () => {
    const scan = scanVirtualEntries("C:/Projects/bulkIMG", [{ path: "package.json", kind: "file", content: "{\"name\":\"internal-package\"}" }]);
    const draft = buildFolderNamedImportDraft({
      folderPath: "C:/Projects/bulkIMG",
      scan,
      existingProjects: [],
    });
    const result = importLocalFolderProject(createInitialState("2026-05-28T00:00:00.000Z"), draft, "2026-05-28T00:00:00.000Z");
    const importedProject = result.state.projects[0];
    const analysis = result.state.projectAnalysisSnapshots[0];

    expect(importedProject?.name).toBe("bulkIMG");
    expect(importedProject && analysis ? getProjectDisplayName(importedProject, analysis) : undefined).toBe("bulkIMG");
  });
});
