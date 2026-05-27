import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_POLICY, isPathInsideRoot, scanVirtualEntries, shouldSkipPath } from "./index";

describe("@pcc/local-fs", () => {
  it("rejects path traversal and parent escape", () => {
    expect(shouldSkipPath("../secrets.txt")).toBe("outside_root");
    expect(isPathInsideRoot("C:/work/project", "C:/work/project/src/index.ts")).toBe(true);
    expect(isPathInsideRoot("C:/work/project", "C:/work/other/.env")).toBe(false);
  });

  it("skips ignored folders and secret files", () => {
    expect(shouldSkipPath("node_modules/react/index.js")).toBe("ignored_by_policy");
    expect(shouldSkipPath(".env")).toBe("secret_denied");
    expect(shouldSkipPath("config/private.key")).toBe("secret_denied");
    expect(shouldSkipPath("notes/github_token.txt")).toBe("secret_denied");
  });

  it("scans only safe read-only metadata samples", () => {
    const result = scanVirtualEntries("C:/work/project", [
      { path: "package.json", kind: "file", content: '{"scripts":{"test":"vitest"}}' },
      { path: ".env", kind: "file", content: "OPENAI_API_KEY=secret" },
      { path: "dist/app.js", kind: "file", content: "generated" },
      { path: "src/main.ts", kind: "file", content: "const todo = 'TODO wire scanner';" },
      { path: "private.pem", kind: "file", content: "BEGIN RSA PRIVATE KEY abc END RSA PRIVATE KEY" },
    ]);

    expect(result.files.map((file) => file.path)).toEqual(["package.json", "src/main.ts"]);
    expect(result.skipped.some((item) => item.reason === "secret_denied")).toBe(true);
    expect(result.files.some((file) => file.contentSample?.includes("secret"))).toBe(false);
  });

  it("marks scans partial when limits are reached", () => {
    const result = scanVirtualEntries(
      "C:/work/project",
      [
        { path: "one.txt", kind: "file", content: "one" },
        { path: "two.txt", kind: "file", content: "two" },
      ],
      { ...DEFAULT_SCAN_POLICY, maxFiles: 1 },
    );

    expect(result.status).toBe("partial");
    expect(result.files).toHaveLength(1);
  });
});
