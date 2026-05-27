import type { ScanFolderResult, ScannedFile } from "@pcc/local-fs";

export interface RepoAnalyzerResult {
  summary: {
    detectedName: string;
    likelyPurpose?: string;
    likelyProjectType: "web_app" | "desktop_app" | "mobile_app" | "api_service" | "library" | "documentation" | "data_project" | "unknown";
    confidence: number;
    shortSummary: string;
    statusSummary: string;
  };
  repo: {
    isGitRepo: boolean;
    branch?: string;
    changedFiles: Array<{ path: string; status: "added" | "modified" | "deleted" | "renamed" | "unknown" }>;
    hasUncommittedChanges: boolean;
  };
  stack: {
    detectedLanguages: string[];
    detectedFrameworks: string[];
    packageManagers: string[];
    configFiles: string[];
    scripts: Array<{ name: string; command: string; category: "dev" | "build" | "test" | "lint" | "format" | "unknown" }>;
  };
  docs: {
    readmeFiles: string[];
    docsFolders: string[];
    statusFiles: string[];
    planningFiles: string[];
    summarizedDocs: Array<{ path: string; title?: string; safeSummary: string }>;
  };
  files: {
    totalFilesSeen: number;
    totalFilesScanned: number;
    totalFilesSkipped: number;
    importantFiles: Array<{ path: string; reason: string; category: "entrypoint" | "config" | "docs" | "test" | "package" | "workflow" | "source" | "unknown" }>;
    recentFiles: Array<{ path: string; modifiedAt: string }>;
    todoMarkers: Array<{ path: string; count: number }>;
  };
  risks: Array<{ id: string; severity: "info" | "low" | "medium" | "high"; title: string; explanation: string; suggestedAction?: string }>;
  blockers: Array<{ title: string; evidence: string[]; confidence: number; recommendedAction?: string }>;
  recommendedNextStep: string | null;
  assistantContextSummary: string;
}

export function analyzeScanResult(scan: ScanFolderResult): RepoAnalyzerResult {
  const filePaths = scan.files.map((file) => file.path);
  const directories = scan.directories;
  const packageJson = scan.files.find((file) => file.path.endsWith("package.json"));
  const packageData = parsePackageJson(packageJson);
  const scripts = extractScripts(packageData);
  const frameworks = detectFrameworks(filePaths, packageData);
  const languages = detectLanguages(scan.files);
  const packageManagers = detectPackageManagers(filePaths);
  const configFiles = filePaths.filter((path) => isConfigFile(path)).slice(0, 12);
  const readmeFiles = filePaths.filter((path) => /(^|\/)readme\.md$/i.test(path));
  const docsFolders = directories.filter((path) => /(^|\/)(docs|documentation)$/i.test(path)).slice(0, 5);
  const statusFiles = filePaths.filter((path) => /(status|implementation|changelog|roadmap).*\.md$/i.test(path)).slice(0, 8);
  const planningFiles = filePaths.filter((path) => /(plan|todo|backlog|milestone).*\.md$/i.test(path)).slice(0, 8);
  const importantFiles = chooseImportantFiles(scan.files);
  const todoMarkers = scan.files
    .map((file) => ({ path: file.path, count: countTodos(file.contentSample ?? "") }))
    .filter((item) => item.count > 0)
    .slice(0, 10);
  const projectType = inferProjectType(filePaths, frameworks, languages);
  const blockers = inferBlockers({ scripts, readmeFiles, statusFiles, todoMarkers, scan });
  const risks = inferRisks(scan, packageJson, readmeFiles);
  const recommendedNextStep = inferNextStep({ scripts, readmeFiles, blockers, scan });
  const detectedName = detectName(scan.rootPath, packageData);
  const repo = {
    isGitRepo: directories.includes(".git") || filePaths.some((path) => path.startsWith(".git/")),
    branch: undefined,
    changedFiles: [] as Array<{ path: string; status: "added" | "modified" | "deleted" | "renamed" | "unknown" }>,
    hasUncommittedChanges: false,
  };

  const statusSummary = [
    `${projectTypeLabel(projectType)} detected`,
    frameworks.length ? `${frameworks.slice(0, 3).join(", ")} stack` : undefined,
    scripts.some((script) => script.category === "test") ? "test script present" : "test script not detected",
    scan.status === "partial" ? "partial safe scan" : "safe scan complete",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    summary: {
      detectedName,
      likelyPurpose: packageData?.description,
      likelyProjectType: projectType,
      confidence: calculateConfidence({ packageJson, readmeFiles, frameworks, languages }),
      shortSummary: packageData?.description || `${detectedName} appears to be a ${projectTypeLabel(projectType).toLowerCase()}.`,
      statusSummary,
    },
    repo,
    stack: { detectedLanguages: languages, detectedFrameworks: frameworks, packageManagers, configFiles, scripts },
    docs: {
      readmeFiles,
      docsFolders,
      statusFiles,
      planningFiles,
      summarizedDocs: readmeFiles
        .map((path) => scan.files.find((file) => file.path === path))
        .filter((file): file is ScannedFile => Boolean(file))
        .slice(0, 3)
        .map((file) => ({ path: file.path, title: firstMarkdownTitle(file.contentSample), safeSummary: summarizeText(file.contentSample ?? "") })),
    },
    files: {
      totalFilesSeen: scan.totalFilesSeen,
      totalFilesScanned: scan.totalFilesScanned,
      totalFilesSkipped: scan.skipped.length,
      importantFiles,
      recentFiles: scan.files
        .filter((file) => file.modifiedAt)
        .sort((left, right) => String(right.modifiedAt).localeCompare(String(left.modifiedAt)))
        .slice(0, 8)
        .map((file) => ({ path: file.path, modifiedAt: file.modifiedAt ?? "" })),
      todoMarkers,
    },
    risks,
    blockers,
    recommendedNextStep,
    assistantContextSummary: `${detectedName}: ${statusSummary}. Recommended next step: ${recommendedNextStep ?? "Review project analysis."}`,
  };
}

function parsePackageJson(file?: ScannedFile): Record<string, any> | undefined {
  if (!file?.contentSample) return undefined;
  try {
    return JSON.parse(file.contentSample) as Record<string, any>;
  } catch {
    return undefined;
  }
}

function extractScripts(packageData?: Record<string, any>): RepoAnalyzerResult["stack"]["scripts"] {
  const scripts = packageData?.scripts;
  if (!scripts || typeof scripts !== "object") return [];
  return Object.entries(scripts).map(([name, command]) => ({
    name,
    command: String(command),
    category: categorizeScript(name),
  }));
}

function categorizeScript(name: string): "dev" | "build" | "test" | "lint" | "format" | "unknown" {
  if (/dev|start/.test(name)) return "dev";
  if (/build/.test(name)) return "build";
  if (/test|spec/.test(name)) return "test";
  if (/lint/.test(name)) return "lint";
  if (/format|prettier/.test(name)) return "format";
  return "unknown";
}

function detectFrameworks(paths: string[], packageData?: Record<string, any>): string[] {
  const dependencies = { ...(packageData?.dependencies ?? {}), ...(packageData?.devDependencies ?? {}) };
  const frameworks = new Set<string>();
  if (dependencies.react || paths.some((path) => /\.tsx$/.test(path))) frameworks.add("React");
  if (dependencies.vite || paths.some((path) => path.includes("vite.config"))) frameworks.add("Vite");
  if (dependencies.next || paths.some((path) => path.includes("next.config"))) frameworks.add("Next.js");
  if (dependencies["@tauri-apps/api"] || paths.some((path) => path.includes("tauri.conf"))) frameworks.add("Tauri");
  if (dependencies["@nestjs/core"]) frameworks.add("NestJS");
  if (paths.some((path) => path.endsWith("Cargo.toml"))) frameworks.add("Rust/Cargo");
  if (paths.some((path) => path.endsWith("pyproject.toml"))) frameworks.add("Python");
  if (paths.some((path) => path.endsWith("go.mod"))) frameworks.add("Go");
  return Array.from(frameworks);
}

function detectLanguages(files: ScannedFile[]): string[] {
  const languages = new Set<string>();
  for (const file of files) {
    if ([".ts", ".tsx"].includes(file.extension)) languages.add("TypeScript");
    if ([".js", ".jsx"].includes(file.extension)) languages.add("JavaScript");
    if (file.extension === ".py") languages.add("Python");
    if (file.extension === ".rs") languages.add("Rust");
    if (file.extension === ".go") languages.add("Go");
    if (file.extension === ".md") languages.add("Markdown");
    if (file.extension === ".sql") languages.add("SQL");
  }
  return Array.from(languages);
}

function detectPackageManagers(paths: string[]): string[] {
  const managers = new Set<string>();
  if (paths.includes("pnpm-lock.yaml")) managers.add("pnpm");
  if (paths.includes("yarn.lock")) managers.add("yarn");
  if (paths.includes("package-lock.json")) managers.add("npm");
  if (paths.includes("bun.lockb")) managers.add("bun");
  if (paths.includes("uv.lock")) managers.add("uv");
  return Array.from(managers);
}

function isConfigFile(path: string): boolean {
  return /(package\.json|tsconfig|vite\.config|next\.config|tauri\.conf|pyproject\.toml|Cargo\.toml|go\.mod|dockerfile|compose\.ya?ml)$/i.test(path);
}

function chooseImportantFiles(files: ScannedFile[]): RepoAnalyzerResult["files"]["importantFiles"] {
  const candidates = files.map((file) => file.path);
  const important: RepoAnalyzerResult["files"]["importantFiles"] = [];
  const add = (path: string, reason: string, category: RepoAnalyzerResult["files"]["importantFiles"][number]["category"]) => {
    if (important.length < 5 && candidates.includes(path) && !important.some((item) => item.path === path)) important.push({ path, reason, category });
  };
  add("package.json", "Node package manifest", "package");
  add("README.md", "Primary project documentation", "docs");
  add("src/App.tsx", "Likely React app entry", "entrypoint");
  add("src/main.tsx", "Likely browser app bootstrap", "entrypoint");
  add("vite.config.ts", "Build configuration", "config");
  add("tsconfig.json", "TypeScript configuration", "config");
  for (const file of candidates) {
    if (important.length >= 5) break;
    if (/(\.github\/workflows\/|src\/index|src\/main|app\/page|pages\/index)/i.test(file)) {
      important.push({ path: file, reason: "Likely workflow or entrypoint", category: file.includes(".github") ? "workflow" : "entrypoint" });
    }
  }
  return important;
}

function inferProjectType(paths: string[], frameworks: string[], languages: string[]): RepoAnalyzerResult["summary"]["likelyProjectType"] {
  if (frameworks.includes("Tauri")) return "desktop_app";
  if (frameworks.some((framework) => ["React", "Vite", "Next.js"].includes(framework))) return "web_app";
  if (frameworks.includes("NestJS") || paths.some((path) => path.includes("apps/api"))) return "api_service";
  if (paths.some((path) => /readme\.md$/i.test(path)) && languages.length === 1 && languages[0] === "Markdown") return "documentation";
  if (paths.some((path) => path.endsWith("pyproject.toml"))) return "data_project";
  return "unknown";
}

function inferBlockers(input: {
  scripts: RepoAnalyzerResult["stack"]["scripts"];
  readmeFiles: string[];
  statusFiles: string[];
  todoMarkers: Array<{ path: string; count: number }>;
  scan: ScanFolderResult;
}): RepoAnalyzerResult["blockers"] {
  const blockers: RepoAnalyzerResult["blockers"] = [];
  if (!input.readmeFiles.length) {
    blockers.push({ title: "README missing", evidence: ["No README file detected"], confidence: 0.72, recommendedAction: "Add or locate project overview documentation." });
  }
  if (!input.scripts.some((script) => script.category === "test")) {
    blockers.push({ title: "No test script detected", evidence: ["package scripts do not include test"], confidence: 0.65, recommendedAction: "Identify verification command before larger changes." });
  }
  if (input.scan.status === "partial") {
    blockers.push({ title: "Partial scan", evidence: ["Safe scan limits were reached"], confidence: 0.82, recommendedAction: "Review skipped summary before trusting analysis fully." });
  }
  if (input.todoMarkers.length) {
    blockers.push({ title: "TODO markers present", evidence: input.todoMarkers.slice(0, 3).map((item) => `${item.path}: ${item.count}`), confidence: 0.55 });
  }
  return blockers.slice(0, 3);
}

function inferRisks(scan: ScanFolderResult, packageJson?: ScannedFile, readmeFiles: string[] = []): RepoAnalyzerResult["risks"] {
  const risks: RepoAnalyzerResult["risks"] = [];
  if (!packageJson) risks.push({ id: "package-missing", severity: "info", title: "No package manifest", explanation: "No package.json was detected in the scanned folder." });
  if (!readmeFiles.length) risks.push({ id: "readme-missing", severity: "low", title: "Documentation missing", explanation: "No README was detected." });
  if (scan.skipped.some((item) => item.reason === "secret_denied")) {
    risks.push({ id: "secrets-skipped", severity: "info", title: "Secrets skipped", explanation: "Secret-like files were intentionally skipped by policy." });
  }
  return risks;
}

function inferNextStep(input: {
  scripts: RepoAnalyzerResult["stack"]["scripts"];
  readmeFiles: string[];
  blockers: RepoAnalyzerResult["blockers"];
  scan: ScanFolderResult;
}): string {
  if (input.scan.status === "partial") return "Review the skipped summary, then run a scoped rescan if the missing areas matter.";
  if (input.blockers.length) return input.blockers[0].recommendedAction ?? `Review blocker: ${input.blockers[0].title}.`;
  if (input.scripts.some((script) => script.category === "test")) return "Run the detected test command and capture the result in a session note.";
  if (input.scripts.some((script) => script.category === "dev")) return "Start the detected dev command and verify the main screen.";
  if (input.readmeFiles.length) return "Read the README and capture the current next exact step.";
  return "Add a short project summary and define the next exact step.";
}

function detectName(rootPath: string, packageData?: Record<string, any>): string {
  if (typeof packageData?.name === "string" && packageData.name.trim()) return packageData.name.replace(/^@[^/]+\//, "");
  return rootPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "Imported project";
}

function calculateConfidence(input: { packageJson?: ScannedFile; readmeFiles: string[]; frameworks: string[]; languages: string[] }): number {
  let confidence = 0.35;
  if (input.packageJson) confidence += 0.2;
  if (input.readmeFiles.length) confidence += 0.15;
  if (input.frameworks.length) confidence += 0.2;
  if (input.languages.length) confidence += 0.1;
  return Math.min(0.95, confidence);
}

function projectTypeLabel(type: RepoAnalyzerResult["summary"]["likelyProjectType"]): string {
  return type.replace(/_/g, " ");
}

function firstMarkdownTitle(content?: string): string | undefined {
  return content?.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim();
}

function summarizeText(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#"));
  return (line ?? "Documentation detected.").slice(0, 220);
}

function countTodos(content: string): number {
  return (content.match(/\b(TODO|FIXME)\b/gi) ?? []).length;
}
