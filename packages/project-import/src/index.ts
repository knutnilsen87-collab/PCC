import { DEFAULT_SCAN_POLICY, summarizeSkipped, type ScanFolderResult } from "@pcc/local-fs";
import { analyzeScanResult } from "@pcc/repo-analyzer";
import type { AnalysisWarning, ProjectAnalysisSnapshot, SkippedPathSummary } from "@pcc/schemas";

export interface LocalFolderImportDraft {
  folderPath: string;
  projectName: string;
  projectDescription?: string;
  currentFocus: string;
  nextExactStep: string;
  analysis: Omit<ProjectAnalysisSnapshot, "id" | "workspaceId" | "projectId" | "locationId" | "createdAt">;
  warnings: AnalysisWarning[];
  skipped: SkippedPathSummary[];
}

export function buildLocalFolderImportDraft(folderPath: string, scan: ScanFolderResult): LocalFolderImportDraft {
  const analysis = analyzeScanResult(scan);
  const warnings = buildAnalysisWarnings(scan);
  const skipped = summarizeSkipped(scan.skipped);

  return {
    folderPath,
    projectName: analysis.summary.detectedName,
    projectDescription: analysis.summary.shortSummary,
    currentFocus: analysis.summary.statusSummary,
    nextExactStep: analysis.recommendedNextStep ?? "Review imported project analysis.",
    warnings,
    skipped,
    analysis: {
      scanPolicyVersion: DEFAULT_SCAN_POLICY.version,
      analysisVersion: "project-analysis-v1",
      status: scan.status,
      summary: analysis.summary,
      repo: analysis.repo,
      stack: analysis.stack,
      docs: analysis.docs,
      files: analysis.files,
      risks: analysis.risks,
      blockers: analysis.blockers,
      recommendedNextStep: analysis.recommendedNextStep,
      assistantContextSummary: analysis.assistantContextSummary,
      warnings,
      skipped,
    },
  };
}

function buildAnalysisWarnings(scan: ScanFolderResult): AnalysisWarning[] {
  const warnings: AnalysisWarning[] = [];
  if (scan.status === "partial") {
    warnings.push({ code: "partial_scan", message: "Safe scan limits were reached; analysis may be incomplete.", severity: "warning" });
  }
  if (scan.skipped.some((item) => item.reason === "secret_denied")) {
    warnings.push({ code: "secret_files_skipped", message: "Secret-like files were skipped by policy.", severity: "info" });
  }
  if (scan.skipped.some((item) => item.reason === "binary")) {
    warnings.push({ code: "binary_files_skipped", message: "Binary files were skipped.", severity: "info" });
  }
  if (!scan.files.length) {
    warnings.push({ code: "unknown_stack", message: "No safe text files were available for stack detection.", severity: "warning" });
  }
  return warnings;
}
