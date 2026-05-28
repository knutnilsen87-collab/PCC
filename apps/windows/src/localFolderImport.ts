import type { ScanFolderResult } from "@pcc/local-fs";
import { buildLocalFolderImportDraft, type LocalFolderImportDraft } from "@pcc/project-import";
import type { Project } from "@pcc/schemas";

export const WEB_DEMO_FALLBACK_LABEL = "Web demo fallback — limited, does not retain folder access";

export interface DesktopFolderScanResult {
  folderPath: string;
  entries: Array<{
    path: string;
    kind: "file" | "directory";
    sizeBytes?: number;
    modifiedAt?: string;
    content?: string;
    isBinary?: boolean;
    symlinkTarget?: string;
  }>;
}

export interface DesktopImportWindow {
  __PCC_DESKTOP__?: {
    pickAndScanFolder?: () => Promise<DesktopFolderScanResult | null | undefined>;
  };
  __TAURI__?: {
    core?: { invoke?: (command: string) => Promise<DesktopFolderScanResult | null | undefined> };
    tauri?: { invoke?: (command: string) => Promise<DesktopFolderScanResult | null | undefined> };
  };
}

export type FolderImportMode = "desktop" | "web_demo";

export function getFolderImportMode(target: DesktopImportWindow): FolderImportMode {
  return getDesktopPicker(target) ? "desktop" : "web_demo";
}

export async function pickDesktopFolder(target: DesktopImportWindow): Promise<DesktopFolderScanResult | undefined> {
  const picker = getDesktopPicker(target);
  const result = picker ? await picker() : undefined;
  if (!result?.folderPath || !Array.isArray(result.entries)) return undefined;
  return result;
}

export function buildFolderNamedImportDraft(input: {
  folderPath: string;
  scan: ScanFolderResult;
  existingProjects: Project[];
}): LocalFolderImportDraft {
  const detectedDraft = buildLocalFolderImportDraft(input.folderPath, input.scan);
  const baseName = deriveProjectNameFromFolderPath(input.folderPath);
  const projectName = makeUniqueProjectName(baseName, input.existingProjects);

  return {
    ...detectedDraft,
    projectName,
  };
}

export function deriveProjectNameFromFolderPath(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, "/").replace(/\/+$/g, "");
  const basename = normalized.split("/").filter(Boolean).pop()?.trim();
  return basename || "Imported Project";
}

export function makeUniqueProjectName(baseName: string, projects: Project[]): string {
  const fallback = baseName.trim() || "Imported Project";
  const existing = new Set(projects.map((project) => project.name.trim().toLowerCase()));
  if (!existing.has(fallback.toLowerCase())) return fallback;

  let index = 2;
  while (existing.has(`${fallback} ${index}`.toLowerCase())) {
    index += 1;
  }
  return `${fallback} ${index}`;
}

function getDesktopPicker(target: DesktopImportWindow): (() => Promise<DesktopFolderScanResult | null | undefined>) | undefined {
  if (typeof target.__PCC_DESKTOP__?.pickAndScanFolder === "function") {
    return target.__PCC_DESKTOP__.pickAndScanFolder;
  }

  const invoke = target.__TAURI__?.core?.invoke ?? target.__TAURI__?.tauri?.invoke;
  if (typeof invoke === "function") {
    return () => invoke("pcc_pick_and_scan_folder");
  }

  return undefined;
}
