import { describe, expect, it } from "vitest";
import { scanVirtualEntries } from "@pcc/local-fs";
import { analyzeScanResult } from "./index";

describe("@pcc/repo-analyzer", () => {
  it("detects a React/Vite TypeScript project with scripts and docs", () => {
    const scan = scanVirtualEntries("C:/work/pcc", [
      { path: "package.json", kind: "file", content: JSON.stringify({ name: "pcc", scripts: { dev: "vite", test: "vitest" }, dependencies: { react: "^18" }, devDependencies: { vite: "^5" } }) },
      { path: "README.md", kind: "file", content: "# PCC\n\nA project command center." },
      { path: "src/App.tsx", kind: "file", content: "export function App(){ return null } // TODO test" },
      { path: "vite.config.ts", kind: "file", content: "export default {}" },
    ]);

    const analysis = analyzeScanResult(scan);
    expect(analysis.summary.detectedName).toBe("pcc");
    expect(analysis.summary.likelyProjectType).toBe("web_app");
    expect(analysis.stack.detectedFrameworks).toContain("React");
    expect(analysis.stack.scripts.some((script) => script.category === "test")).toBe(true);
    expect(analysis.files.todoMarkers[0].path).toBe("src/App.tsx");
  });

  it("surfaces missing verification as a possible blocker", () => {
    const scan = scanVirtualEntries("C:/work/docs-only", [
      { path: "README.md", kind: "file", content: "# Docs\n\nOnly docs." },
    ]);

    const analysis = analyzeScanResult(scan);
    expect(analysis.blockers.some((blocker) => blocker.title.includes("No test"))).toBe(true);
  });
});
