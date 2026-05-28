import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  CircleDot,
  FileDown,
  FolderOpen,
  FolderPlus,
  MessageSquareText,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SquarePen,
  Upload,
  X,
} from "lucide-react";
import { runAssistantCommand } from "@pcc/assistant";
import {
  activeOpenBlockers,
  applyApproval,
  archiveProject,
  createBlocker,
  createAiResumeSuggestion,
  createInitialState,
  createProject,
  endSessionWithResume,
  getLatestResume,
  getLatestAnalysisSnapshot,
  hydrateState,
  importFileToProject,
  importLocalFolderProject,
  projectTimeline,
  rejectApproval,
  rescanLocalFolderProject,
  restoreProject,
  type AppState,
} from "@pcc/domain";
import { DEFAULT_SCAN_POLICY, scanVirtualEntries, shouldSkipPath, type ScannableEntry } from "@pcc/local-fs";
import { buildLocalFolderImportDraft } from "@pcc/project-import";
import type { AttachmentCategory, Project, ProjectAnalysisSnapshot } from "@pcc/schemas";
import {
  WEB_DEMO_FALLBACK_LABEL,
  buildFolderNamedImportDraft,
  getFolderImportMode,
  pickDesktopFolder,
  type DesktopImportWindow,
} from "./localFolderImport";
import {
  friendlyProjectSummary,
  buildTodayProjectRows,
  getAssistantQuickActions,
  getImportedProjectDisplayStatus,
  getProjectDisplayName,
  getRecommendedAction,
  getSetupChecklist,
  getSetupProgressText,
  getTodayRecommendation,
  getTodaySummary,
  type TodayProjectRow,
} from "./importOverview";

const storageKey = "pcc.local.state.v1";

type ImportState =
  | { status: "idle" }
  | { status: "picking_folder" | "folder_selected" | "scanning" | "analyzing" | "creating_project"; message: string }
  | { status: "completed"; message: string }
  | { status: "cancelled" | "failed"; message: string };

type ViewMode = "today" | "project" | "repo";

export function App() {
  const [state, setState] = usePersistentState();
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(state.projects[0]?.id);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [sessionSummary, setSessionSummary] = useState("");
  const [sessionNextStep, setSessionNextStep] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantOutput, setAssistantOutput] = useState("Import a folder or create a project to start your command center.");
  const [fileCategory, setFileCategory] = useState<AttachmentCategory>("docs");
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const assistantInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderImportMode = getFolderImportMode(window as unknown as DesktopImportWindow);

  const activeProject = state.projects.find((project) => project.id === activeProjectId) ?? state.projects[0];
  const activeDisplayName = activeProject ? getProjectDisplayName(activeProject, getLatestAnalysisSnapshot(state, activeProject.id)) : undefined;
  const resume = activeProject ? getLatestResume(state, activeProject.id) : undefined;
  const analysis = activeProject ? getLatestAnalysisSnapshot(state, activeProject.id) : undefined;
  const blockers = activeProject ? activeOpenBlockers(state, activeProject.id) : [];
  const timeline = activeProject ? projectTimeline(state, activeProject.id) : [];
  const attachments = activeProject ? state.attachments.filter((attachment) => attachment.projectId === activeProject.id) : [];
  const approvals = state.approvals.filter((approval) => approval.status === "pending");

  useEffect(() => {
    if (!activeProjectId && state.projects[0]) setActiveProjectId(state.projects[0].id);
  }, [activeProjectId, state.projects]);

  const health = useMemo(() => {
    if (!activeProject) return "No project";
    if (activeProject.origin === "local_folder_import") {
      return getImportedProjectDisplayStatus({ project: activeProject, analysis, resume, openBlockers: blockers });
    }
    if (blockers.length) return "Blocked";
    if (resume) return "Resume ready";
    return "Needs resume";
  }, [activeProject, analysis, blockers, resume]);

  function handleCreateProject() {
    const name = projectName.trim() || "Untitled project";
    const nextState = createProject(state, {
      name,
      description: projectDescription.trim() || "Private project workspace.",
      priority: projectName.trim() ? "high" : "medium",
      nextExactStep: projectName.trim() ? "Capture the first session and define the next exact step." : "Define the first useful next action.",
    });
    setState(nextState);
    setActiveProjectId(nextState.projects[0].id);
    setViewMode("project");
    setProjectName("");
    setProjectDescription("");
    setAssistantOutput(`Project added: ${getProjectDisplayName(nextState.projects[0])}.`);
  }

  function handleCreateEmptyProject() {
    const nextState = createProject(state, {
      name: "Untitled project",
      description: "Private project workspace.",
      priority: "medium",
      nextExactStep: "Define the first useful next action.",
    });
    setState(nextState);
    setActiveProjectId(nextState.projects[0].id);
    setViewMode("project");
    setProjectName("");
    setProjectDescription("");
    setAssistantOutput("Project added. Define the first next action when you are ready.");
  }

  async function handleImportFolder() {
    setImportState({ status: "picking_folder", message: "Opening native desktop folder picker..." });
    try {
      const desktopWindow = window as unknown as DesktopImportWindow;
      if (getFolderImportMode(desktopWindow) === "desktop") {
        const selectedFolder = await pickDesktopFolder(desktopWindow);
        if (!selectedFolder) {
          setImportState({ status: "cancelled", message: "Folder import cancelled." });
          return;
        }
        setImportState({ status: "folder_selected", message: `Selected ${selectedFolder.folderPath}.` });
        await importScannedFolder(selectedFolder.folderPath, selectedFolder.entries, "desktop");
        return;
      }

      const message = `${WEB_DEMO_FALLBACK_LABEL}. Use this only for local development or demo import.`;
      setImportState({ status: "picking_folder", message });
      setAssistantOutput(`${message} The production desktop app uses a native folder picker and does not trigger browser upload prompts.`);
      folderInputRef.current?.click();
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "Folder import cancelled." : error instanceof Error ? error.message : "Folder import failed.";
      setImportState({ status: message.includes("cancelled") ? "cancelled" : "failed", message });
    }
  }

  async function handleFolderInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) {
      setImportState({ status: "cancelled", message: "Folder import cancelled." });
      return;
    }

    try {
      await importBrowserFileList(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Folder import failed.";
      setImportState({ status: "failed", message });
      setAssistantOutput(message);
    } finally {
      event.target.value = "";
    }
  }

  async function importBrowserFileList(files: FileList) {
    const firstPath = getBrowserFileRelativePath(files[0]);
    const rootName = firstPath.includes("/") ? firstPath.split("/")[0] : "selected-folder";
    setImportState({ status: "folder_selected", message: `Selected ${rootName}.` });
    const entries = await collectBrowserFileEntries(files, rootName);
    const displayPath = `[selected-folder]/${rootName}`;
    return importScannedFolder(displayPath, entries, "web_demo");
  }

  async function importScannedFolder(folderPath: string, entries: ScannableEntry[], source: "desktop" | "web_demo") {
    setImportState({ status: "scanning", message: "Reading safe metadata locally..." });
    const scan = scanVirtualEntries(folderPath, entries);
    setImportState({ status: "analyzing", message: "Creating safe project analysis snapshot..." });
    const draft = buildFolderNamedImportDraft({ folderPath, scan, existingProjects: state.projects });
    setImportState({ status: "creating_project", message: "Creating project overview..." });
    const result = importLocalFolderProject(state, draft);
    setState(result.state);
    setActiveProjectId(result.projectId);
    setViewMode("project");
    const importedProject = result.state.projects.find((project) => project.id === result.projectId);
    const displayName = importedProject ? getProjectDisplayName(importedProject, getLatestAnalysisSnapshot(result.state, result.projectId)) : draft.projectName;
    const message = result.duplicate ? `Opened existing project: ${displayName}.` : `Project added: ${displayName}. Safe scan complete.`;
    setAssistantOutput(result.duplicate ? message : getImportSuccessMessage(source));
    setImportState({ status: "completed", message });
    return result;
  }

  async function handleRescanActiveProject() {
    if (!activeProject) return;
    const desktopWindow = window as unknown as DesktopImportWindow;
    if (getFolderImportMode(desktopWindow) !== "desktop") {
      const message = `${WEB_DEMO_FALLBACK_LABEL}. Re-import the folder in this demo mode to create a fresh safe scan.`;
      setImportState({
        status: "failed",
        message,
      });
      setAssistantOutput(message);
      return;
    }

    const selectedFolder = await pickDesktopFolder(desktopWindow);
    if (!selectedFolder) {
      setImportState({ status: "cancelled", message: "Rescan cancelled." });
      return;
    }
    setImportState({ status: "scanning", message: "Rescanning selected folder read-only..." });
    const displayPath = selectedFolder.folderPath || activeProject.localFolderPath || activeProject.name;
    const scan = scanVirtualEntries(displayPath, selectedFolder.entries);
    const draft = buildLocalFolderImportDraft(displayPath, scan);
    setState(rescanLocalFolderProject(state, activeProject.id, draft));
    setImportState({ status: "completed", message: "New immutable analysis snapshot created." });
    setAssistantOutput("Rescan complete. The project analysis snapshot was updated without changing user-authored notes.");
  }

  function handleEndSession() {
    if (!activeProject || !sessionSummary.trim() || !sessionNextStep.trim()) return;
    const nextState = endSessionWithResume(state, {
      projectId: activeProject.id,
      summary: sessionSummary,
      nextStep: sessionNextStep,
      blockerIds: blockers.map((blocker) => blocker.id),
    });
    setState(nextState);
    setSessionSummary("");
    setSessionNextStep("");
    setAssistantOutput("Session saved and resume snapshot updated.");
  }

  function handleCreateBlocker() {
    if (!activeProject || !blockerTitle.trim()) return;
    setState(
      createBlocker(state, {
        projectId: activeProject.id,
        title: blockerTitle,
        severity: "high",
        nextAction: "Decide owner and unblock path.",
      }),
    );
    setBlockerTitle("");
    setAssistantOutput("Blocker created and project marked blocked.");
  }

  function handleAssistantSubmit() {
    if (!assistantInput.trim()) {
      setAssistantOutput(activeProject ? "Type a command, or use a quick action for this project." : "Import a folder or create a project first, then ask the assistant for help.");
      assistantInputRef.current?.focus();
      return;
    }
    const response = runAssistantCommand(
      state,
      {
        activeWorkspaceId: state.workspace.id,
        activeProjectId: activeProject?.id,
        currentScreen: viewMode === "today" ? "dashboard" : viewMode,
        userPermissions: ["workspace.read", "project.read", "project.write"],
      },
      assistantInput,
    );
    if (response.state) setState(response.state);
    if (response.targetProjectId) {
      setActiveProjectId(response.targetProjectId);
      setViewMode("project");
    }
    setAssistantOutput(response.text);
    setAssistantInput("");
  }

  function handleCreateResumeFromAnalysis() {
    if (!activeProject || !analysis) return;
    const nextState = createAiResumeSuggestion(state, {
      projectId: activeProject.id,
      youStoppedHere: analysis.assistantContextSummary,
      nextExactStep: analysis.recommendedNextStep ?? activeProject.nextExactStep ?? "Review project summary and confirm the next step.",
      currentFocus: analysis.summary.statusSummary,
      confidence: analysis.summary.confidence,
    });
    setState(nextState);
    setAssistantOutput("I drafted a resume snapshot. Review it before saving to project memory.");
  }

  function handleAssistantQuickAction(action: string) {
    if (!activeProject) return;
    if (action === "Create resume snapshot") {
      handleCreateResumeFromAnalysis();
      return;
    }
    if ((action === "Summarize project" || action === "Review project summary") && analysis) {
      setAssistantOutput(friendlyProjectSummary(analysis));
      return;
    }
    if (action === "Find next step") {
      setAssistantOutput(`Recommended next step: ${analysis?.recommendedNextStep ?? activeProject.nextExactStep ?? "Review the project summary."}`);
      return;
    }
    if (action === "Generate Codex handoff" && analysis) {
      setAssistantOutput(
        `Codex handoff draft: ${getProjectDisplayName(activeProject, analysis)}. Status: ${analysis.summary.statusSummary}. Next: ${analysis.recommendedNextStep ?? activeProject.nextExactStep ?? "Review analysis"}.`,
      );
      return;
    }
    if (action === "Generate Codex handoff") {
      setAssistantOutput("No analysis snapshot is available for a Codex handoff yet. Import or rescan a folder first.");
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!activeProject) return;
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    let nextState = state;
    for (const file of files) {
      nextState = importFileToProject(nextState, {
        projectId: activeProject.id,
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || undefined,
        category: fileCategory,
        hash: await quickHash(file),
      });
    }
    setState(nextState);
    setAssistantOutput(`${files.length} file${files.length === 1 ? "" : "s"} added to ${getProjectDisplayName(activeProject, analysis)}.`);
  }

  return (
    <main className="app-shell" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <input
        ref={folderInputRef}
        type="file"
        multiple
        aria-hidden="true"
        tabIndex={-1}
        className="hidden-folder-input"
        onChange={handleFolderInputChange}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />
      <aside className="sidebar">
        <div className="brand">
          <CircleDot aria-hidden="true" />
          <div>
            <strong>Project Command Center</strong>
            <span>{state.workspace.name}</span>
          </div>
        </div>

        <section className="create-project">
          <button type="button" className="primary" onClick={handleImportFolder} aria-label="Import local project folder">
            <FolderPlus size={16} /> Import folder
          </button>
          {folderImportMode === "web_demo" && <p className="web-demo-fallback-note">{WEB_DEMO_FALLBACK_LABEL}</p>}
          <label>
            <span>Create empty project</span>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" />
          </label>
          <textarea
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Short description"
            rows={2}
          />
          <button type="button" className="primary" onClick={handleCreateProject}>
            <Plus size={16} /> Create
          </button>
        </section>

        <nav className="project-list" aria-label="Projects">
          <button
            type="button"
            className={viewMode === "today" ? "project-button today-button active" : "project-button today-button"}
            onClick={() => setViewMode("today")}
          >
            <span>Today</span>
            <small>Daily command center</small>
          </button>
          {state.projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={project.id === activeProject?.id && viewMode !== "today" ? "project-button active" : "project-button"}
              onClick={() => {
                setActiveProjectId(project.id);
                setViewMode("project");
              }}
            >
              <span>{getProjectDisplayName(project, getLatestAnalysisSnapshot(state, project.id))}</span>
              <small>
                {project.origin === "local_folder_import"
                  ? getImportedProjectDisplayStatus({
                      project,
                      analysis: getLatestAnalysisSnapshot(state, project.id),
                      resume: getLatestResume(state, project.id),
                      openBlockers: activeOpenBlockers(state, project.id),
                    })
                  : project.status}
              </small>
            </button>
          ))}
          {!state.projects.length && <p className="empty-copy">Import a local folder first, or create an empty project manually.</p>}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{viewMode === "today" ? "Private workspace" : viewMode === "repo" ? "Technical route" : "Project"}</span>
            <h1>{viewMode === "today" ? "Today" : viewMode === "repo" ? "Repo" : activeDisplayName ?? "No project selected"}</h1>
          </div>
          <div className="top-actions">
            <span className="status-pill">{viewMode === "today" ? "Start here" : viewMode === "repo" ? "Repo view" : health}</span>
            {activeProject && viewMode !== "repo" && (
              <button type="button" onClick={() => setViewMode("repo")}>
                <FolderOpen size={16} /> Open repo
              </button>
            )}
            <button
              type="button"
              title="Search"
              onClick={() => {
                setAssistantOutput("Search is handled through the command bar. Type what you want to find or ask.");
                assistantInputRef.current?.focus();
              }}
            >
              <Search size={16} />
            </button>
            {viewMode !== "today" && activeProject?.status === "archived" ? (
              <button type="button" onClick={() => setState(restoreProject(state, activeProject.id))} title="Restore project">
                <RotateCcw size={16} />
              </button>
            ) : viewMode !== "today" && activeProject ? (
              <button type="button" onClick={() => setState(archiveProject(state, activeProject.id))} title="Archive project">
                <Archive size={16} />
              </button>
            ) : null}
          </div>
        </header>

        {viewMode === "today" ? (
          <TodayView
            state={state}
            activeProjectId={activeProjectId}
            onSelectProject={(projectId) => {
              setActiveProjectId(projectId);
              setViewMode("project");
            }}
            onImportFolder={handleImportFolder}
            onCreateProject={handleCreateEmptyProject}
            importState={importState}
          />
        ) : viewMode === "repo" && activeProject ? (
          <RepoView
            project={activeProject}
            analysis={analysis}
            onBackToProject={() => setViewMode("project")}
            onRescan={handleRescanActiveProject}
            onGenerateCodexHandoff={() => handleAssistantQuickAction("Generate Codex handoff")}
          />
        ) : activeProject ? (
          <ProjectSurface
            project={activeProject}
            resume={resume}
            blockers={blockers}
            attachments={attachments}
            analysis={analysis}
            timeline={timeline}
            importState={importState}
            sessionSummary={sessionSummary}
            sessionNextStep={sessionNextStep}
            blockerTitle={blockerTitle}
            fileCategory={fileCategory}
            approvals={approvals}
            onSessionSummaryChange={setSessionSummary}
            onSessionNextStepChange={setSessionNextStep}
            onEndSession={handleEndSession}
            onBlockerTitleChange={setBlockerTitle}
            onCreateBlocker={handleCreateBlocker}
            onFileCategoryChange={setFileCategory}
            onImportFolder={handleImportFolder}
            onRescan={handleRescanActiveProject}
            onCreateResumeFromAnalysis={handleCreateResumeFromAnalysis}
            onAssistantQuickAction={handleAssistantQuickAction}
            onApprove={(approvalId) => setState(applyApproval(state, approvalId))}
            onReject={(approvalId) => setState(rejectApproval(state, approvalId))}
          />
        ) : (
          <section className="empty-state">
            <FolderOpen size={32} />
            <h2>No project selected</h2>
            <p>Start by importing a local project folder. Project Command Center will scan it read-only, detect key files, summarize status, and create a project memory surface.</p>
            <div className="empty-actions">
              <button type="button" className="primary" onClick={handleImportFolder}>
                <FolderPlus size={16} /> Import folder
              </button>
              <button type="button" onClick={handleCreateEmptyProject}>
                <Plus size={16} /> Create empty project
              </button>
            </div>
            <ImportProgress state={importState} />
          </section>
        )}
      </section>

      <footer className="assistant-bar">
        <div className="assistant-status">
          <MessageSquareText size={18} />
          <span>{assistantOutput}</span>
        </div>
        {getAssistantQuickActions(activeProject).length > 0 && (
          <div className="assistant-chips" aria-label="Assistant quick actions">
            {getAssistantQuickActions(activeProject).map((action) => (
              <button type="button" key={action} onClick={() => handleAssistantQuickAction(action)}>
                {action}
              </button>
            ))}
          </div>
        )}
        <div className="assistant-input-row">
          <input
            ref={assistantInputRef}
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAssistantSubmit();
            }}
            placeholder={
              activeProject?.origin === "local_folder_import"
                ? "Ask about this project, create a next step, summarize status, or generate a Codex handoff."
                : activeProject
                  ? `Ask about ${activeDisplayName}, or type "draft resume: ..."`
                  : "Import a folder or create a project to start your command center."
            }
            aria-label="Assistant command"
          />
          <button type="button" className={assistantInput.trim() ? "assistant-submit ready" : "assistant-submit"} onClick={handleAssistantSubmit}>
            <SquarePen size={16} /> Run
          </button>
        </div>
      </footer>
    </main>
  );
}

interface ProjectSurfaceProps {
  project: Project;
  resume: ReturnType<typeof getLatestResume>;
  blockers: ReturnType<typeof activeOpenBlockers>;
  attachments: AppState["attachments"];
  analysis: ProjectAnalysisSnapshot | undefined;
  timeline: AppState["timelineEvents"];
  importState: ImportState;
  sessionSummary: string;
  sessionNextStep: string;
  blockerTitle: string;
  fileCategory: AttachmentCategory;
  approvals: AppState["approvals"];
  onSessionSummaryChange: (value: string) => void;
  onSessionNextStepChange: (value: string) => void;
  onEndSession: () => void;
  onBlockerTitleChange: (value: string) => void;
  onCreateBlocker: () => void;
  onFileCategoryChange: (value: AttachmentCategory) => void;
  onImportFolder: () => void;
  onRescan: () => void;
  onCreateResumeFromAnalysis: () => void;
  onAssistantQuickAction: (action: string) => void;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}

function TodayView({
  state,
  activeProjectId,
  onSelectProject,
  onImportFolder,
  onCreateProject,
  importState,
}: {
  state: AppState;
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onImportFolder: () => void;
  onCreateProject: () => void;
  importState: ImportState;
}) {
  const projectRows = buildTodayProjectRows(state);
  const { activeCount, blockedCount, readyCount } = getTodaySummary(projectRows);
  const recommended = getTodayRecommendation(projectRows);
  const needsAttention = projectRows.filter((row) => row.hasAttention).slice(0, 4);
  const ready = projectRows.filter((row) => row.status === "Ready to continue" && row.blockers.length === 0).slice(0, 4);

  if (!projectRows.length) {
    return (
      <section className="today-view">
        <div className="today-hero">
          <span className="eyebrow">Today</span>
          <h2>No projects yet.</h2>
          <p>Import a folder or create your first project to start your command center.</p>
          <div className="today-actions">
            <button type="button" className="primary" onClick={onImportFolder}>
              <FolderPlus size={16} /> Import folder
            </button>
            <button type="button" onClick={onCreateProject}>
              <Plus size={16} /> Create project
            </button>
          </div>
        </div>
        <ImportProgress state={importState} />
      </section>
    );
  }

  return (
    <section className="today-view">
      <div className="today-heading">
        <span className="eyebrow">Today</span>
        <h2>Good morning, Knut.</h2>
        <p className="today-summary">
          You have {activeCount} active project{activeCount === 1 ? "" : "s"}, {blockedCount} blocked project{blockedCount === 1 ? "" : "s"},
          and {readyCount} project{readyCount === 1 ? "" : "s"} ready to resume.
        </p>
      </div>

      {recommended && (
        <section className="today-hero">
          <div>
            <span className="eyebrow">Best next move</span>
            <h2>Resume {recommended.displayName}</h2>
            <p>
              <strong>Next:</strong> {recommended.nextStep}
            </p>
          </div>
          <button type="button" className="primary" onClick={() => onSelectProject(recommended.project.id)}>
            <ShieldCheck size={16} /> Resume project
          </button>
        </section>
      )}

      <ImportProgress state={importState} />

      <section className="today-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Needs attention</span>
            <h3>Review before resuming</h3>
          </div>
        </div>
        <ProjectRows rows={needsAttention.length ? needsAttention : projectRows.slice(0, 3)} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
      </section>

      {ready.length > 0 && (
        <section className="today-section">
          <span className="eyebrow">Ready to continue</span>
          <ProjectRows rows={ready} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
        </section>
      )}

      <section className="today-section">
        <span className="eyebrow">All projects</span>
        <ProjectRows rows={projectRows} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
      </section>
    </section>
  );
}

function ProjectRows({
  rows,
  activeProjectId,
  onSelectProject,
}: {
  rows: TodayProjectRow[];
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
}) {
  return (
    <div className="project-row-list">
      {rows.map((row) => (
        <button
          type="button"
          key={row.project.id}
          className={row.project.id === activeProjectId ? "project-row active" : "project-row"}
          onClick={() => onSelectProject(row.project.id)}
        >
          <span className="project-row-title">
            <span aria-hidden="true" className={`status-dot ${row.status === "Blocked" ? "danger" : row.status === "Ready to continue" ? "ready" : ""}`} />
            {row.displayName}
          </span>
          <span className="project-row-meta">
            {row.status} - Next: {row.nextStep}
          </span>
        </button>
      ))}
    </div>
  );
}

function RepoView({
  project,
  analysis,
  onBackToProject,
  onRescan,
  onGenerateCodexHandoff,
}: {
  project: Project;
  analysis?: ProjectAnalysisSnapshot;
  onBackToProject: () => void;
  onRescan: () => void;
  onGenerateCodexHandoff: () => void;
}) {
  const displayName = getProjectDisplayName(project, analysis);
  const attention = [
    ...(analysis?.blockers.map((blocker) => blocker.title) ?? []),
    ...(analysis?.risks.filter((risk) => risk.severity !== "info").map((risk) => risk.title) ?? []),
    ...(analysis?.warnings.map((warning) => warning.message) ?? []),
    ...(analysis?.skipped.map((item) => `${item.reason}: ${item.count}`) ?? []),
  ];

  return (
    <section className="repo-view">
      <div className="repo-header">
        <div>
          <span className="eyebrow">Repo</span>
          <h2>{displayName}</h2>
          <p>{project.localFolderPath ?? "Path unavailable. Re-import the folder to restore browser folder access."}</p>
        </div>
        <div className="repo-actions">
          <button type="button" onClick={onBackToProject}>
            Back to project
          </button>
          <button type="button" onClick={onRescan}>
            <RotateCcw size={16} /> Run deeper scan
          </button>
          <button type="button" onClick={onGenerateCodexHandoff}>
            Generate Codex handoff
          </button>
        </div>
      </div>

      <section className="repo-meta-grid">
        <article className="repo-section">
          <span className="eyebrow">Project path</span>
          <p>{project.localFolderPath ?? "Path unavailable. Re-import the folder to restore browser folder access."}</p>
        </article>
        <article className="repo-section">
          <span className="eyebrow">Raw project name</span>
          <p>{project.name}</p>
        </article>
        <article className="repo-section">
          <span className="eyebrow">Scan status</span>
          <p>{analysis ? `${analysis.files.totalFilesScanned} files scanned - ${analysis.files.totalFilesSkipped} skipped` : "No scan snapshot available."}</p>
        </article>
        <article className="repo-section">
          <span className="eyebrow">Git</span>
          <p>{analysis?.repo?.isGitRepo ? `Git repo${analysis.repo.branch ? ` - ${analysis.repo.branch}` : ""}` : "No Git metadata detected"}</p>
        </article>
      </section>

      <section className="repo-section">
        <span className="eyebrow">Stack</span>
        <p>
          {[...(analysis?.stack.detectedFrameworks ?? []), ...(analysis?.stack.detectedLanguages ?? [])].join(", ") || "No framework or language signals detected."}
        </p>
      </section>

      <section className="repo-section">
        <span className="eyebrow">Important files</span>
        <ul className="repo-file-list">
          {analysis?.files.importantFiles.slice(0, 10).map((file) => (
            <li key={file.path}>
              <strong>{formatFileName(file.path)}</strong>
              <span>{file.reason}</span>
            </li>
          ))}
          {!analysis?.files.importantFiles.length && <li>No important files were highlighted by the latest safe scan.</li>}
        </ul>
      </section>

      <section className="repo-section">
        <span className="eyebrow">Attention</span>
        <ul className="friendly-list">
          {attention.slice(0, 10).map((item) => (
            <li key={item}>{item}</li>
          ))}
          {!attention.length && <li>No attention items in the latest scan.</li>}
        </ul>
      </section>
    </section>
  );
}

function ProjectSurface(props: ProjectSurfaceProps) {
  if (props.analysis && props.project.origin === "local_folder_import") {
    return (
      <ImportedProjectOverview
        project={props.project}
        analysis={props.analysis}
        resume={props.resume}
        blockers={props.blockers}
        importState={props.importState}
        onCreateResumeFromAnalysis={props.onCreateResumeFromAnalysis}
        onRescan={props.onRescan}
        onAssistantQuickAction={props.onAssistantQuickAction}
      />
    );
  }

  return (
    <div className="project-surface">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Project truth</span>
          <h2>{props.project.currentFocus ?? "Define current focus"}</h2>
          <p>{props.project.description ?? "No description yet. Capture the work context before the next session ends."}</p>
        </div>
        <div className="progress-block">
          <span>{props.project.progress}%</span>
          <div aria-label="Project progress" className="progress-track">
            <div style={{ width: `${props.project.progress}%` }} />
          </div>
        </div>
      </section>

      <ImportProgress state={props.importState} />

      {props.analysis && <AnalysisPanel analysis={props.analysis} onRescan={props.onRescan} />}

      <section className="grid">
        <article className="panel primary-panel">
          <div className="panel-title">
            <ShieldCheck size={17} />
            <h3>Resume</h3>
          </div>
          {props.resume ? (
            <>
              <p className="quiet-label">You stopped here</p>
              <p>{props.resume.youStoppedHere}</p>
              <p className="quiet-label">Next exact step</p>
              <p className="next-step">{props.resume.nextExactStep}</p>
            </>
          ) : (
            <p className="empty-copy">End a session or ask the assistant to draft a resume snapshot.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-title">
            <SquarePen size={17} />
            <h3>End session</h3>
          </div>
          <textarea
            value={props.sessionSummary}
            onChange={(event) => props.onSessionSummaryChange(event.target.value)}
            placeholder="What changed in this session?"
            rows={4}
          />
          <input
            value={props.sessionNextStep}
            onChange={(event) => props.onSessionNextStepChange(event.target.value)}
            placeholder="Next exact step"
          />
          <button type="button" className="primary" onClick={props.onEndSession}>
            <Check size={16} /> Save session
          </button>
        </article>

        <article className="panel">
          <div className="panel-title">
            <X size={17} />
            <h3>Blockers</h3>
          </div>
          <div className="inline-action">
            <input
              value={props.blockerTitle}
              onChange={(event) => props.onBlockerTitleChange(event.target.value)}
              placeholder="New blocker"
            />
            <button type="button" onClick={props.onCreateBlocker} title="Create blocker">
              <Plus size={16} />
            </button>
          </div>
          {props.blockers.length ? (
            <ul className="compact-list">
              {props.blockers.map((blocker) => (
                <li key={blocker.id}>
                  <strong>{blocker.title}</strong>
                  <span>{blocker.severity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No open blockers.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-title">
            <Upload size={17} />
            <h3>Files</h3>
          </div>
          <select value={props.fileCategory} onChange={(event) => props.onFileCategoryChange(event.target.value as AttachmentCategory)}>
            <option value="docs">Docs</option>
            <option value="assets">Assets</option>
            <option value="prompts">Prompts</option>
            <option value="screenshots">Screenshots</option>
            <option value="source">Source</option>
            <option value="other">Other</option>
          </select>
          <p className="drop-copy">Drop files anywhere in the app to import them into the active project.</p>
          {props.attachments.length ? (
            <ul className="compact-list">
              {props.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <strong>{attachment.originalName}</strong>
                  <span>{attachment.category}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No files imported yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-title">
            <ShieldCheck size={17} />
            <h3>Approvals</h3>
          </div>
          {props.approvals.length ? (
            <ul className="approval-list">
              {props.approvals.map((approval) => (
                <li key={approval.id}>
                  <div>
                    <strong>{approval.title}</strong>
                    <span>{approval.summary}</span>
                  </div>
                  <div className="button-pair">
                    <button type="button" onClick={() => props.onApprove(approval.id)} title="Approve">
                      <Check size={16} />
                    </button>
                    <button type="button" onClick={() => props.onReject(approval.id)} title="Reject">
                      <X size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No pending approvals.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-title">
            <FileDown size={17} />
            <h3>Timeline</h3>
          </div>
          {props.timeline.length ? (
            <ul className="timeline-list">
              {props.timeline.map((event) => (
                <li key={event.id}>
                  <span>{event.eventType}</span>
                  <strong>{event.title}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No project events yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function ImportedProjectOverview({
  project,
  analysis,
  resume,
  blockers,
  importState,
  onCreateResumeFromAnalysis,
  onRescan,
  onAssistantQuickAction,
}: {
  project: Project;
  analysis: ProjectAnalysisSnapshot;
  resume: ReturnType<typeof getLatestResume>;
  blockers: ReturnType<typeof activeOpenBlockers>;
  importState: ImportState;
  onCreateResumeFromAnalysis: () => void;
  onRescan: () => void;
  onAssistantQuickAction: (action: string) => void;
}) {
  const checklist = getSetupChecklist({ analysis, resume, nextStep: project.nextExactStep });
  const recommended = getRecommendedAction({ analysis, resume });
  const displayStatus = getImportedProjectDisplayStatus({ project, analysis, resume, openBlockers: blockers });
  const displayName = getProjectDisplayName(project, analysis);
  const nextStep = resume?.nextExactStep ?? analysis.recommendedNextStep ?? project.nextExactStep ?? "Review the project summary and confirm the next step.";
  const attention = analysis.blockers.length
    ? analysis.blockers.map((blocker) => blocker.title)
    : analysis.risks.filter((risk) => risk.severity !== "info").map((risk) => risk.title);
  const missionItems = checklist.map((item) => {
    if (item.label === "Folder imported") return { ...item, label: "Import complete" };
    if (item.label === "Safe scan completed") return { ...item, label: "Safe scan complete" };
    if (item.label === "Summary reviewed") return { ...item, label: item.complete ? "Summary reviewed" : "Summary pending" };
    if (item.label === "Resume snapshot created") return { ...item, label: item.complete ? "Resume ready" : "Resume pending" };
    return item;
  });

  return (
    <div className="project-surface imported-overview command-canvas">
      <section className="imported-header compact-imported-header">
        <div>
          <span className="eyebrow">Project imported</span>
          <h2>Project imported: {displayName}</h2>
          <p>{analysis.summary.shortSummary}</p>
        </div>
        <span className="status-pill">{displayStatus}</span>
      </section>

      <section className="next-action-card resume-hero simple-project-hero">
        <div>
          <span className="eyebrow">What should happen next?</span>
          <h3>{recommended.title}</h3>
          <p>{recommended.why}</p>
          <div className="simple-status-grid" aria-label="Project import status">
            <div>
              <span>Project</span>
              <strong>{displayName}</strong>
            </div>
            <div>
              <span>Approx. complete</span>
              <strong>{project.progress}%</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{analysis.summary.statusSummary}</strong>
            </div>
          </div>
          <p className="next-planned-step">
            <span>Next planned step</span>
            {nextStep}
          </p>
        </div>
        <div className="next-action-buttons">
          <button type="button" className="primary" onClick={onCreateResumeFromAnalysis}>
            <ShieldCheck size={16} /> {recommended.primaryCta}
          </button>
        </div>
      </section>

      <ImportProgress state={importState} />

      <section className="setup-checklist-card mission-strip compact-mission-strip">
        <span className="eyebrow">Setup progress</span>
        <h3>{getSetupProgressText(checklist)}</h3>
        <ol className="setup-checklist">
          {missionItems.map((item) => (
            <li key={item.label} className={item.complete ? "complete" : ""}>
              <span>{item.complete ? "Done" : "Pending"}</span>
              {item.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="project-document simple-overview-grid">
        <article className="overview-card context-card">
          <span className="eyebrow">Project summary</span>
          <h3>{analysis.summary.statusSummary}</h3>
          <p>{friendlyProjectSummary(analysis)}</p>
        </article>

        <article className="overview-card">
          <span className="eyebrow">Important areas/files</span>
          <ul className="friendly-list">
            {analysis.files.importantFiles.slice(0, 4).map((file) => (
              <li key={file.path}>
                <strong>{formatFileName(file.path)}</strong>
                <span>{file.reason}</span>
              </li>
            ))}
            {!analysis.files.importantFiles.length && <li>No key files stood out in the safe scan.</li>}
          </ul>
        </article>

        <article className="overview-card">
          <span className="eyebrow">{blockers.length ? "Attention needed" : "Observations"}</span>
          <ul className="friendly-list">
            {attention.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {!attention.length && <li>No immediate attention items found.</li>}
          </ul>
        </article>
      </section>

      <details className="project-context-details">
        <summary>More actions</summary>
        <div className="secondary-action-grid">
          {recommended.secondaryActions.map((action) => (
            <button type="button" key={action} onClick={() => (action === "Run deeper scan" ? onRescan() : onAssistantQuickAction(action))}>
              {action}
            </button>
          ))}
        </div>
      </details>

      <details className="technical-details">
        <summary>Technical scan details</summary>
        <div className="technical-detail-grid">
          <div>
            <p className="quiet-label">Observations</p>
            <ul>
              {analysis.risks.map((risk) => (
                <li key={risk.id}>{risk.title}</li>
              ))}
              {!analysis.risks.length && <li>No notable technical observations.</li>}
            </ul>
          </div>
          <div>
            <p className="quiet-label">Technical details</p>
            <ul>
              <li>Files scanned: {analysis.files.totalFilesScanned}</li>
              <li>Files skipped: {analysis.files.totalFilesSkipped}</li>
              <li>Detected frameworks: {analysis.stack.detectedFrameworks.join(", ") || "none"}</li>
              {analysis.skipped.map((item) => (
                <li key={item.reason}>
                  {item.reason}: {item.count}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

function ImportProgress({ state }: { state: ImportState }) {
  if (state.status === "idle") return null;
  return (
    <section className={`import-state ${state.status === "failed" ? "error" : ""}`} aria-live="polite">
      <strong>{state.status === "completed" ? "Import complete" : state.status === "failed" ? "Could not import this folder" : "Analyzing project folder..."}</strong>
      <span>{state.message}</span>
      {["picking_folder", "folder_selected", "scanning", "analyzing", "creating_project"].includes(state.status) && (
        <ul>
          <li>Reading safe metadata</li>
          <li>Detecting repo status</li>
          <li>Finding key files</li>
          <li>Creating project analysis</li>
        </ul>
      )}
    </section>
  );
}

function AnalysisPanel({ analysis, onRescan }: { analysis: ProjectAnalysisSnapshot; onRescan: () => void }) {
  return (
    <section className="analysis-panel">
      <div className="analysis-header">
        <div>
          <span className="eyebrow">Project detected</span>
          <h2>{analysis.summary.detectedName}</h2>
          <p>{analysis.summary.shortSummary}</p>
        </div>
        <button type="button" onClick={onRescan} title="Rescan active project">
          <RotateCcw size={16} /> Rescan
        </button>
      </div>
      <div className="analysis-grid">
        <div>
          <p className="quiet-label">Status summary</p>
          <strong>{analysis.summary.statusSummary}</strong>
        </div>
        <div>
          <p className="quiet-label">Detected stack</p>
          <strong>{analysis.stack.detectedFrameworks.concat(analysis.stack.detectedLanguages).slice(0, 5).join(", ") || "Unknown"}</strong>
        </div>
        <div>
          <p className="quiet-label">Repo status</p>
          <strong>{analysis.repo?.isGitRepo ? `Git repo${analysis.repo.branch ? ` on ${analysis.repo.branch}` : ""}` : "No Git metadata detected"}</strong>
        </div>
        <div>
          <p className="quiet-label">Recommended next step</p>
          <strong>{analysis.recommendedNextStep ?? "Review analysis and define next exact step."}</strong>
        </div>
      </div>
      <div className="analysis-columns">
        <AnalysisList title="Important files" items={analysis.files.importantFiles.slice(0, 5).map((file) => `${file.path} - ${file.reason}`)} />
        <AnalysisList title="Possible blockers" items={analysis.blockers.slice(0, 3).map((blocker) => blocker.title)} empty="No likely blockers detected." />
        <AnalysisList title="Warnings/skipped" items={analysis.warnings.map((warning) => warning.message).concat(analysis.skipped.map((item) => `${item.reason}: ${item.count}`))} empty="No warnings." />
      </div>
    </section>
  );
}

function AnalysisList({ title, items, empty = "Nothing detected." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="quiet-label">{title}</p>
      {items.length ? (
        <ul className="analysis-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">{empty}</p>
      )}
    </div>
  );
}

function usePersistentState(): [AppState, (state: AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? hydrateState(JSON.parse(raw)) : createInitialState();
    } catch {
      return createInitialState();
    }
  });

  function persist(nextState: AppState) {
    setState(nextState);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    } catch (error) {
      console.warn("Project Command Center could not persist local state.", error);
    }
  }

  return [state, persist];
}

async function quickHash(file: File): Promise<string> {
  const input = `${file.name}:${file.size}:${file.lastModified}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatFileName(path: string): string {
  const parts = path.split("/");
  const file = parts[parts.length - 1] ?? path;
  const parent = parts.length > 1 ? parts[parts.length - 2] : undefined;
  return parent ? `${parent}/${file}` : file;
}

function getImportSuccessMessage(source: "desktop" | "web_demo"): string {
  if (source === "desktop") {
    return "Project added from the native desktop picker. The scan stayed local and read-only.";
  }

  return `${WEB_DEMO_FALLBACK_LABEL}. Project added from a one-time browser file selection. The demo fallback does not retain folder access.`;
}

async function collectBrowserFileEntries(files: FileList, rootName: string): Promise<ScannableEntry[]> {
  const entries: ScannableEntry[] = [];
  const seenDirectories = new Set<string>();

  for (const file of Array.from(files)) {
    const rawPath = getBrowserFileRelativePath(file);
    const withoutRoot = rawPath.startsWith(`${rootName}/`) ? rawPath.slice(rootName.length + 1) : rawPath;
    const relativePath = withoutRoot || file.name;
    const directoryParts = relativePath.split("/").slice(0, -1);
    let currentPath = "";

    for (const part of directoryParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!seenDirectories.has(currentPath)) {
        seenDirectories.add(currentPath);
        entries.push({ path: currentPath, kind: "directory" });
      }
    }

    const skipReason = shouldSkipPath(relativePath);
    let content: string | undefined;
    const canReadContent =
      !skipReason &&
      file.size <= DEFAULT_SCAN_POLICY.maxFileBytesForContentRead &&
      (file.type.startsWith("text/") || /\.(json|md|ts|tsx|js|jsx|css|html|yaml|yml|toml|rs|go|py|sql)$/i.test(file.name));

    if (canReadContent) {
      content = await file.text();
    }

    entries.push({
      path: relativePath,
      kind: "file",
      sizeBytes: file.size,
      modifiedAt: new Date(file.lastModified).toISOString(),
      content,
      isBinary: Boolean(file.type && !file.type.startsWith("text/") && !/\.(json|md|ts|tsx|js|jsx|css|html|yaml|yml|toml|rs|go|py|sql)$/i.test(file.name)),
    });
  }

  return entries;
}

function getBrowserFileRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}
