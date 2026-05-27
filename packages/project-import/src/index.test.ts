import { describe, expect, it } from "vitest";
import { scanVirtualEntries } from "@pcc/local-fs";
import { buildLocalFolderImportDraft } from "./index";

describe("@pcc/project-import", () => {
  it("turns a scan into an import draft with immutable analysis data", () => {
    const scan = scanVirtualEntries("C:/work/pcc", [
      { path: "package.json", kind: "file", content: JSON.stringify({ name: "pcc", scripts: { test: "vitest" }, dependencies: { react: "^18" } }) },
      { path: "README.md", kind: "file", content: "# PCC\n\nCommand center." },
    ]);

    const draft = buildLocalFolderImportDraft("C:/work/pcc", scan);
    expect(draft.projectName).toBe("pcc");
    expect(draft.analysis.summary.likelyProjectType).toBe("web_app");
    expect(draft.nextExactStep).toBeTruthy();
  });

  it("summarizes secret-denied files without exposing contents", () => {
    const scan = scanVirtualEntries("C:/work/pcc", [
      { path: ".env", kind: "file", content: "OPENAI_API_KEY=abc" },
      { path: "README.md", kind: "file", content: "# Safe" },
    ]);

    const draft = buildLocalFolderImportDraft("C:/work/pcc", scan);
    expect(draft.skipped[0].reason).toBe("secret_denied");
    expect(JSON.stringify(draft)).not.toContain("OPENAI_API_KEY");
  });
});
