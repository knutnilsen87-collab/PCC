export interface ScanPolicy {
  mode: "read_only";
  version: string;
  maxDepth: number;
  maxFiles: number;
  maxFileBytesForContentRead: number;
  includeHiddenFiles: boolean;
  respectGitignore: boolean;
  ignoreGlobs: string[];
  secretDenyGlobs: string[];
}

export interface ScannableEntry {
  path: string;
  kind: "file" | "directory";
  sizeBytes?: number;
  modifiedAt?: string;
  content?: string;
  isBinary?: boolean;
  symlinkTarget?: string;
}

export interface ScannedFile {
  path: string;
  sizeBytes: number;
  modifiedAt?: string;
  contentSample?: string;
  extension: string;
}

export interface SkippedPath {
  path: string;
  reason:
    | "ignored_by_policy"
    | "gitignored"
    | "secret_denied"
    | "too_large"
    | "binary"
    | "permission_denied"
    | "outside_root";
}

export interface ScanFolderResult {
  rootPath: string;
  status: "complete" | "partial" | "failed";
  files: ScannedFile[];
  directories: string[];
  skipped: SkippedPath[];
  totalFilesSeen: number;
  totalFilesScanned: number;
  warnings: string[];
}

export const DEFAULT_SCAN_POLICY: ScanPolicy = {
  mode: "read_only",
  version: "local-folder-import-v1",
  maxDepth: 8,
  maxFiles: 5000,
  maxFileBytesForContentRead: 250_000,
  includeHiddenFiles: false,
  respectGitignore: true,
  ignoreGlobs: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/.turbo/**",
    "**/.cache/**",
    "**/coverage/**",
    "**/target/**",
    "**/vendor/**",
    "**/__pycache__/**",
    "**/.venv/**",
    "**/venv/**",
  ],
  secretDenyGlobs: [
    "**/.env",
    "**/.env.*",
    "**/*secret*",
    "**/*token*",
    "**/*credential*",
    "**/*private_key*",
    "**/*.pem",
    "**/*.key",
    "**/id_rsa",
    "**/id_ed25519",
    "**/.aws/**",
    "**/.gcp/**",
    "**/.azure/**",
  ],
};

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".7z",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
]);

const ignoredDirectoryNames = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "coverage",
  "target",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
]);

const secretPartPattern = /(^\.env(\..*)?$|secret|token|credential|private_key|^id_rsa$|^id_ed25519$|.*\.pem$|.*\.key$)/i;

export function normalizeSafeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function isPathTraversal(path: string): boolean {
  return normalizeSafeRelativePath(path)
    .split("/")
    .some((part) => part === "..");
}

export function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const root = normalizeAbsolutePath(rootPath);
  const candidate = normalizeAbsolutePath(candidatePath);
  return candidate === root || candidate.startsWith(`${root}/`);
}

export function shouldSkipPath(path: string, policy: ScanPolicy = DEFAULT_SCAN_POLICY): SkippedPath["reason"] | null {
  const normalized = normalizeSafeRelativePath(path);
  if (!normalized || isPathTraversal(normalized)) return "outside_root";
  const parts = normalized.split("/");
  if (parts.some((part) => secretPartPattern.test(part))) return "secret_denied";
  if (!policy.includeHiddenFiles && parts.some((part) => part.startsWith(".") && part !== ".")) {
    if (matchesAny(normalized, policy.secretDenyGlobs)) return "secret_denied";
    return "ignored_by_policy";
  }
  if (parts.some((part) => ignoredDirectoryNames.has(part))) return "ignored_by_policy";
  if (matchesAny(normalized, policy.secretDenyGlobs)) return "secret_denied";
  if (matchesAny(normalized, policy.ignoreGlobs)) return "ignored_by_policy";
  return null;
}

export function isProbablyBinary(path: string, content?: string): boolean {
  const extension = getExtension(path);
  if (binaryExtensions.has(extension)) return true;
  return typeof content === "string" && content.includes("\0");
}

export function redactSecretLikeContent(content: string): string {
  return content
    .replace(/(OPENAI_API_KEY=)[^\s]+/g, "$1[REDACTED]")
    .replace(/(ANTHROPIC_API_KEY=)[^\s]+/g, "$1[REDACTED]")
    .replace(/(GITHUB_TOKEN=)[^\s]+/g, "$1[REDACTED]")
    .replace(/(AWS_ACCESS_KEY_ID=)[^\s]+/g, "$1[REDACTED]")
    .replace(/(AWS_SECRET_ACCESS_KEY=)[^\s]+/g, "$1[REDACTED]")
    .replace(/BEGIN (RSA|OPENSSH) PRIVATE KEY[\s\S]*?END \1 PRIVATE KEY/g, "[REDACTED PRIVATE KEY]");
}

export function scanVirtualEntries(
  rootPath: string,
  entries: ScannableEntry[],
  policy: ScanPolicy = DEFAULT_SCAN_POLICY,
): ScanFolderResult {
  const files: ScannedFile[] = [];
  const directories: string[] = [];
  const skipped: SkippedPath[] = [];
  let totalFilesSeen = 0;
  let status: ScanFolderResult["status"] = "complete";

  for (const entry of entries) {
    const relativePath = normalizeSafeRelativePath(entry.path);
    const depth = relativePath ? relativePath.split("/").length - 1 : 0;
    const skipReason = shouldSkipPath(relativePath, policy);

    if (skipReason) {
      skipped.push({ path: relativePath, reason: skipReason });
      continue;
    }

    if (entry.symlinkTarget && !isPathInsideRoot(rootPath, entry.symlinkTarget)) {
      skipped.push({ path: relativePath, reason: "outside_root" });
      continue;
    }

    if (depth > policy.maxDepth) {
      skipped.push({ path: relativePath, reason: "ignored_by_policy" });
      status = "partial";
      continue;
    }

    if (entry.kind === "directory") {
      directories.push(relativePath);
      continue;
    }

    totalFilesSeen += 1;
    if (files.length >= policy.maxFiles) {
      skipped.push({ path: relativePath, reason: "ignored_by_policy" });
      status = "partial";
      continue;
    }

    const sizeBytes = entry.sizeBytes ?? byteLength(entry.content ?? "");
    if (sizeBytes > policy.maxFileBytesForContentRead) {
      skipped.push({ path: relativePath, reason: "too_large" });
      status = "partial";
      continue;
    }

    if (entry.isBinary || isProbablyBinary(relativePath, entry.content)) {
      skipped.push({ path: relativePath, reason: "binary" });
      continue;
    }

    files.push({
      path: relativePath,
      sizeBytes,
      modifiedAt: entry.modifiedAt,
      extension: getExtension(relativePath),
      contentSample: entry.content ? redactSecretLikeContent(entry.content).slice(0, policy.maxFileBytesForContentRead) : undefined,
    });
  }

  return {
    rootPath,
    status,
    files,
    directories,
    skipped,
    totalFilesSeen,
    totalFilesScanned: files.length,
    warnings: buildWarnings(skipped, status),
  };
}

export function summarizeSkipped(skipped: SkippedPath[]) {
  const grouped = new Map<SkippedPath["reason"], { reason: SkippedPath["reason"]; count: number; examples: string[] }>();
  for (const item of skipped) {
    const current = grouped.get(item.reason) ?? { reason: item.reason, count: 0, examples: [] };
    current.count += 1;
    if (current.examples.length < 3) current.examples.push(item.path);
    grouped.set(item.reason, current);
  }
  return Array.from(grouped.values());
}

function buildWarnings(skipped: SkippedPath[], status: ScanFolderResult["status"]): string[] {
  const warnings: string[] = [];
  if (status === "partial") warnings.push("partial_scan");
  if (skipped.some((item) => item.reason === "secret_denied")) warnings.push("secret_files_skipped");
  if (skipped.some((item) => item.reason === "binary")) warnings.push("binary_files_skipped");
  return warnings;
}

function normalizeAbsolutePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(path));
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`, "i");
}

function getExtension(path: string): string {
  const file = path.split("/").pop() ?? "";
  const index = file.lastIndexOf(".");
  return index >= 0 ? file.slice(index).toLowerCase() : "";
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
