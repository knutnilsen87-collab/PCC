import { useEffect, useMemo, useState } from "react";
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
  friendlyProjectSummary,
  getAssistantQuickActions,
  getImportedProjectDisplayStatus,
  getRecommendedAction,
  getSetupChecklist,
  getSetupProgressText,
} from "./importOverview";

const storageKey = "pcc.local.state.v1";

interface BrowserFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface BrowserDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, BrowserFileHandle | BrowserDirectoryHandle]>;
}

type ImportState =
  | { status: "idle" }
  | { status: "picking_folder" | "folder_selected" | "scanning" | "analyzing" | "creating_project"; message: string }
  | { status: "completed"; message: string }
  | { status: "cancelled" | "failed"; message: string };

export function App() {
  const [state, setState] = usePersistentState();
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(state.projects[0]?.id);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [sessionSummary, setSessionSummary] = useState("");
  const [sessionNextStep, setSessionNextStep] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantOutput, setAssistantOutput] = useState("Import a local folder or create an empty project to activate the command surface.");
  const [fileCategory, setFileCategory] = useState<AttachmentCategory>("docs");
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [directoryHandles, setDirectoryHandles] = useState<Record<string, BrowserDirectoryHandle>>({});

  const activeProject = state.projects.find((project) => project.id === activeProjectId) ?? state.projects[0];
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
    if (!projectName.trim()) return;
    const nextState = createProject(state, {
      name: projectName,
      description: projectDescription,
      priority: "high",
      nextExactStep: "Capture the first session and define the next exact step.",
    });
    setState(nextState);
    setActiveProjectId(nextState.projects[0].id);
    setProjectName("");
    setProjectDescription("");
    setAssistantOutput(`Created ${nextState.projects[0].name}.`);
  }

  async function handleImportFolder() {
    setImportState({ status: "picking_folder", message: "Opening folder picker..." });
    try {
      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<BrowserDirectoryHandle> }).showDirectoryPicker;
      if (!picker) {
        setImportState({
          status: "failed",
          message: "This browser does not expose a folder picker. Run the app in Chromium/Edge or the future Tauri shell.",
        });
        return;
      }
      const handle = await picker();
      setImportState({ status: "folder_selected", message: `Selected ${handle.name}.` });
      const imported = await importDirectoryHandle(handle);
      setDirectoryHandles((current) => ({ ...current, [imported.projectId]: handle }));
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "Folder import cancelled." : error instanceof Error ? error.message : "Folder import failed.";
      setImportState({ status: message.includes("cancelled") ? "cancelled" : "failed", message });
    }
  }

  async function importDirectoryHandle(handle: BrowserDirectoryHandle) {
    setImportState({ status: "scanning", message: "Reading safe metadata..." });
    const entries = await collectDirectoryEntries(handle);
    const displayPath = `[selected-folder]/${handle.name}`;
    const scan = scanVirtualEntries(displayPath, entries);
    setImportState({ status: "analyzing", message: "Detecting repo status and project signals..." });
    const draft = buildLocalFolderImportDraft(displayPath, scan);
    setImportState({ status: "creating_project", message: "Creating project analysis..." });
    const result = importLocalFolderProject(state, draft);
    setState(result.state);
    setActiveProjectId(result.projectId);
    const message = result.duplicate ? `Opened existing import for ${draft.projectName}.` : `Imported ${draft.projectName} read-only.`;
    setAssistantOutput(result.duplicate ? message : "Project imported. I can summarize status, suggest next step, or draft a Codex handoff.");
    setImportState({ status: "completed", message });
    return result;
  }

  async function handleRescanActiveProject() {
    if (!activeProject) return;
    const handle = directoryHandles[activeProject.id];
    if (!handle) {
      setImportState({
        status: "failed",
        message: "Rescan needs the folder to be selected again after a browser reload. Import the same folder to reopen the existing project.",
      });
      return;
    }
    setImportState({ status: "scanning", message: "Rescanning active project read-only..." });
    const entries = await collectDirectoryEntries(handle);
    const displayPath = activeProject.localFolderPath ?? `[selected-folder]/${handle.name}`;
    const scan = scanVirtualEntries(displayPath, entries);
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
    setAssistantOutput("Session ended and resume snapshot updated.");
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
    const response = runAssistantCommand(
      state,
      {
        activeWorkspaceId: state.workspace.id,
        activeProjectId: activeProject?.id,
        currentScreen: activeProject ? "project" : "dashboard",
        userPermissions: ["workspace.read", "project.read", "project.write"],
      },
      assistantInput,
    );
    if (response.state) setState(response.state);
    if (response.targetProjectId) setActiveProjectId(response.targetProjectId);
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
    setAssistantOutput("I drafted a resume snapshot from the import analysis. Review it in Approvals before applying.");
  }

  function handleAssistantQuickAction(action: string) {
    if (!activeProject) return;
    if (action === "Create resume snapshot") {
      handleCreateResumeFromAnalysis();
      return;
    }
    if (action === "Summarize project" && analysis) {
      setAssistantOutput(friendlyProjectSummary(analysis));
      return;
    }
    if (action === "Find next step") {
      setAssistantOutput(`Recommended next step: ${analysis?.recommendedNextStep ?? activeProject.nextExactStep ?? "Review the project summary."}`);
      return;
    }
    if (action === "Generate Codex handoff" && analysis) {
      setAssistantOutput(
        `Codex handoff draft: ${activeProject.name}. Status: ${analysis.summary.statusSummary}. Next: ${analysis.recommendedNextStep ?? activeProject.nextExactStep ?? "Review analysis"}.`,
      );
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
    setAssistantOutput(`${files.length} file${files.length === 1 ? "" : "s"} imported into ${activeProject.name}.`);
  }

  return (
    <main className="app-shell" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
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
          {state.projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={project.id === activeProject?.id ? "project-button active" : "project-button"}
              onClick={() => setActiveProjectId(project.id)}
            >
              <span>{project.name}</span>
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
            <span className="eyebrow">Active workspace</span>
            <h1>{activeProject?.name ?? "No project selected"}</h1>
          </div>
          <div className="top-actions">
            <span className="status-pill">{health}</span>
            <button type="button" title="Search">
              <Search size={16} />
            </button>
            {activeProject?.status === "archived" ? (
              <button type="button" onClick={() => setState(restoreProject(state, activeProject.id))} title="Restore project">
                <RotateCcw size={16} />
              </button>
            ) : activeProject ? (
              <button type="button" onClick={() => setState(archiveProject(state, activeProject.id))} title="Archive project">
                <Archive size={16} />
              </button>
            ) : null}
          </div>
        </header>

        {activeProject ? (
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
              <button type="button" onClick={() => setProjectName("Untitled project")}>
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
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAssistantSubmit();
            }}
            placeholder={
              activeProject?.origin === "local_folder_import"
                ? "Ask about this project, generate next step, rescan, or create a Codex handoff..."
                : activeProject
                  ? `Ask about ${activeProject.name}, or type "draft resume: ..."`
                  : "Import a local folder or create an empty project first"
            }
            aria-label="Assistant command"
          />
          <button type="button" className="assistant-submit" onClick={handleAssistantSubmit}>
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
  const attention = analysis.blockers.length
    ? analysis.blockers.map((blocker) => blocker.title)
    : analysis.risks.filter((risk) => risk.severity !== "info").map((risk) => risk.title);

  return (
    <div className="project-surface imported-overview">
      <section className="imported-header">
        <div>
          <span className="eyebrow">Project imported</span>
          <h2>Project imported: {project.name}</h2>
          <p>{friendlyProjectSummary(analysis)}</p>
        </div>
        <span className="status-pill">{displayStatus}</span>
      </section>

      <ImportProgress state={importState} />

      <section className="setup-checklist-card">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Setup progress</span>
            <h3>{getSetupProgressText(checklist)}</h3>
          </div>
        </div>
        <ul className="setup-checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.complete ? "complete" : ""}>
              <span>{item.complete ? "Done" : ""}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="next-action-card">
        <div>
          <span className="eyebrow">What should happen next?</span>
          <h3>{recommended.title}</h3>
          <p>{recommended.why}</p>
        </div>
        <div className="next-action-buttons">
          <button type="button" className="primary" onClick={onCreateResumeFromAnalysis}>
            <ShieldCheck size={16} /> {recommended.primaryCta}
          </button>
          {recommended.secondaryActions.map((action) => (
            <button type="button" key={action} onClick={() => (action === "Run deeper scan" ? onRescan() : onAssistantQuickAction(action))}>
              {action}
            </button>
          ))}
        </div>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <span className="eyebrow">Project summary</span>
          <h3>{analysis.summary.statusSummary}</h3>
          <p>{analysis.summary.shortSummary}</p>
          <p className="quiet-body">{analysis.docs.readmeFiles.length ? "A README or project documentation was found." : "No README was found in the safe scan."}</p>
        </article>

        <article className="overview-card">
          <span className="eyebrow">Important areas/files</span>
          <ul className="friendly-list">
            {analysis.files.importantFiles.slice(0, 5).map((file) => (
              <li key={file.path}>
                <strong>{formatFileName(file.path)}</strong>
                <span>{file.reason}</span>
              </li>
            ))}
            {!analysis.files.importantFiles.length && <li>No key files stood out in the safe scan.</li>}
          </ul>
        </article>

        <article className="overview-card">
          <span className="eyebrow">Attention needed</span>
          <ul className="friendly-list">
            {attention.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {!attention.length && <li>No immediate attention items found.</li>}
          </ul>
        </article>
      </section>

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
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
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

async function collectDirectoryEntries(handle: BrowserDirectoryHandle): Promise<ScannableEntry[]> {
  const entries: ScannableEntry[] = [];
  await walkDirectory(handle, "", entries, 0);
  return entries;
}

async function walkDirectory(handle: BrowserDirectoryHandle, basePath: string, entries: ScannableEntry[], depth: number) {
  if (depth > DEFAULT_SCAN_POLICY.maxDepth + 1 || entries.length > DEFAULT_SCAN_POLICY.maxFiles * 2) return;
  for await (const [name, child] of handle.entries()) {
    const relativePath = basePath ? `${basePath}/${name}` : name;
    if (child.kind === "directory") {
      entries.push({ path: relativePath, kind: "directory" });
      if (!shouldSkipPath(relativePath)) {
        await walkDirectory(child, relativePath, entries, depth + 1);
      }
      continue;
    }

    const file = await child.getFile();
    let content: string | undefined;
    const skipReason = shouldSkipPath(relativePath);
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
}
