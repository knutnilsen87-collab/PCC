import {
  type AISuggestion,
  type Approval,
  type Attachment,
  type AttachmentCategory,
  type AuditLog,
  type Blocker,
  type Decision,
  type Location,
  type Note,
  type Priority,
  type Project,
  type ProjectAnalysisSnapshot,
  ProjectAnalysisSnapshotSchema,
  ProjectSchema,
  type ProjectStatus,
  type ResumeSnapshot,
  ResumeSnapshotSchema,
  type Session,
  type TimelineEvent,
  type Workspace,
  WorkspaceSchema,
} from "@pcc/schemas";
import type { LocalFolderImportDraft } from "@pcc/project-import";

export interface AppState {
  workspace: Workspace;
  projects: Project[];
  resumeSnapshots: ResumeSnapshot[];
  sessions: Session[];
  blockers: Blocker[];
  notes: Note[];
  decisions: Decision[];
  attachments: Attachment[];
  locations: Location[];
  projectAnalysisSnapshots: ProjectAnalysisSnapshot[];
  timelineEvents: TimelineEvent[];
  auditLogs: AuditLog[];
  aiSuggestions: AISuggestion[];
  approvals: Approval[];
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  priority?: Priority;
  category?: string;
  currentFocus?: string;
  nextExactStep?: string;
}

export interface SessionEndInput {
  projectId: string;
  summary: string;
  completedWork?: string[];
  whatWorks?: string[];
  whatFailed?: string[];
  nextStep: string;
  blockerIds?: string[];
}

export interface BlockerCreateInput {
  projectId: string;
  title: string;
  description?: string;
  severity?: Blocker["severity"];
  nextAction?: string;
}

export interface FileImportInput {
  projectId: string;
  originalName: string;
  sizeBytes: number;
  mimeType?: string;
  category: AttachmentCategory;
  hash?: string;
  originalPath?: string;
}

export interface ResumeDraftInput {
  projectId: string;
  youStoppedHere: string;
  nextExactStep: string;
  currentFocus?: string;
  confidence?: number;
}

export const defaultWorkspaceId = "workspace-local";

export function createInitialState(now = new Date().toISOString()): AppState {
  const workspace = WorkspaceSchema.parse({
    id: defaultWorkspaceId,
    name: "Personal Command Center",
    slug: "personal-command-center",
    ownerUserId: "local-user",
    settings: {
      assistantEnabled: true,
      localPersistence: "browser_local",
      reducedMotion: false,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return {
    workspace,
    projects: [],
    resumeSnapshots: [],
    sessions: [],
    blockers: [],
    notes: [],
    decisions: [],
    attachments: [],
    locations: [],
    projectAnalysisSnapshots: [],
    timelineEvents: [
      createTimelineEvent(workspace.id, undefined, "workspace.created", "Workspace ready", "system", now),
    ],
    auditLogs: [],
    aiSuggestions: [],
    approvals: [],
  };
}

export function hydrateState(raw: unknown): AppState {
  const state = raw as Partial<AppState>;
  const fallback = createInitialState();
  return {
    workspace: WorkspaceSchema.parse(state.workspace ?? fallback.workspace),
    projects: (state.projects ?? []).map((project) => ProjectSchema.parse(project)),
    resumeSnapshots: (state.resumeSnapshots ?? []).map((resume) => ResumeSnapshotSchema.parse(resume)),
    sessions: state.sessions ?? [],
    blockers: state.blockers ?? [],
    notes: state.notes ?? [],
    decisions: state.decisions ?? [],
    attachments: state.attachments ?? [],
    locations: state.locations ?? [],
    projectAnalysisSnapshots: (state.projectAnalysisSnapshots ?? []).map((snapshot) => ProjectAnalysisSnapshotSchema.parse(snapshot)),
    timelineEvents: state.timelineEvents ?? fallback.timelineEvents,
    auditLogs: state.auditLogs ?? [],
    aiSuggestions: state.aiSuggestions ?? [],
    approvals: state.approvals ?? [],
  };
}

export function importLocalFolderProject(
  state: AppState,
  draft: LocalFolderImportDraft,
  now = new Date().toISOString(),
): { state: AppState; projectId: string; duplicate: boolean } {
  const duplicateLocation = state.locations.find(
    (location) => location.type === "local_folder" && normalizePathForCompare(location.pathOrUrl) === normalizePathForCompare(draft.folderPath),
  );
  if (duplicateLocation) {
    const project = state.projects.find((candidate) => candidate.id === duplicateLocation.projectId);
    return {
      state: {
        ...state,
        timelineEvents: [
          createTimelineEvent(
            state.workspace.id,
            project?.id,
            "project.local_folder_duplicate_detected",
            `Local folder already imported: ${draft.projectName}`,
            "system",
            now,
          ),
          ...state.timelineEvents,
        ],
      },
      projectId: project?.id ?? duplicateLocation.projectId,
      duplicate: true,
    };
  }

  const projectId = makeId("project");
  const locationId = makeId("location");
  const snapshotId = makeId("analysis");

  const location: Location = {
    id: locationId,
    workspaceId: state.workspace.id,
    projectId,
    label: draft.projectName,
    type: "local_folder",
    pathOrUrl: draft.folderPath,
    accessMode: "read_only",
    isPrimary: true,
    description: "User-selected local project folder imported read-only.",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const snapshot = ProjectAnalysisSnapshotSchema.parse({
    ...draft.analysis,
    id: snapshotId,
    workspaceId: state.workspace.id,
    projectId,
    locationId,
    createdAt: now,
  });

  const project = ProjectSchema.parse({
    id: projectId,
    workspaceId: state.workspace.id,
    name: draft.projectName,
    slug: slugify(draft.projectName),
    description: draft.projectDescription,
    status: "active",
    priority: "medium",
    progress: 10,
    currentFocus: draft.currentFocus,
    nextExactStep: draft.nextExactStep,
    localFolderPath: draft.folderPath,
    origin: "local_folder_import",
    primaryLocationId: locationId,
    latestAnalysisSnapshotId: snapshotId,
    lastOpenedAt: now,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return {
    state: {
      ...state,
      projects: [project, ...state.projects],
      locations: [location, ...state.locations],
      projectAnalysisSnapshots: [snapshot, ...state.projectAnalysisSnapshots],
      timelineEvents: [
        createTimelineEvent(state.workspace.id, project.id, "project.analysis_snapshot_created", "Project analysis snapshot created", "system", now, [
          { entityType: "projectAnalysisSnapshot", entityId: snapshot.id, label: snapshot.summary.detectedName },
        ]),
        createTimelineEvent(state.workspace.id, project.id, "project.local_folder_scan_completed", "Local folder scan completed", "system", now),
        createTimelineEvent(state.workspace.id, project.id, "project.imported_from_local_folder", `Imported ${project.name}`, "user", now, [
          { entityType: "project", entityId: project.id, label: project.name },
        ]),
        ...state.timelineEvents,
      ],
      auditLogs: [
        createAuditLog(state.workspace.id, "folder_import_completed", "project", project.id, undefined, { project, locationId, snapshotId }, now),
        createAuditLog(state.workspace.id, "folder_import_requested", "location", location.id, undefined, { path: location.pathOrUrl, accessMode: "read_only" }, now),
        ...state.auditLogs,
      ],
    },
    projectId,
    duplicate: false,
  };
}

export function rescanLocalFolderProject(
  state: AppState,
  projectId: string,
  draft: LocalFolderImportDraft,
  now = new Date().toISOString(),
): AppState {
  const project = state.projects.find((candidate) => candidate.id === projectId);
  const location = state.locations.find((candidate) => candidate.id === project?.primaryLocationId);
  if (!project || !location) return state;

  const snapshot = ProjectAnalysisSnapshotSchema.parse({
    ...draft.analysis,
    id: makeId("analysis"),
    workspaceId: state.workspace.id,
    projectId,
    locationId: location.id,
    createdAt: now,
  });

  return {
    ...state,
    projects: state.projects.map((candidate) =>
      candidate.id === projectId
        ? {
            ...candidate,
            latestAnalysisSnapshotId: snapshot.id,
            updatedAt: now,
            lastActivityAt: now,
            version: candidate.version + 1,
          }
        : candidate,
    ),
    projectAnalysisSnapshots: [snapshot, ...state.projectAnalysisSnapshots],
    timelineEvents: [
      createTimelineEvent(state.workspace.id, projectId, "project.analysis_snapshot_created", "Project analysis snapshot created", "system", now),
      createTimelineEvent(state.workspace.id, projectId, "project.local_folder_scan_completed", "Local folder rescan completed", "system", now),
      createTimelineEvent(state.workspace.id, projectId, "project.rescan_requested", "Local folder rescan requested", "user", now),
      ...state.timelineEvents,
    ],
    auditLogs: [
      createAuditLog(state.workspace.id, "rescan_completed", "project", projectId, undefined, { snapshotId: snapshot.id }, now),
      ...state.auditLogs,
    ],
  };
}

export function getLatestAnalysisSnapshot(state: AppState, projectId: string): ProjectAnalysisSnapshot | undefined {
  const project = state.projects.find((candidate) => candidate.id === projectId);
  return (
    state.projectAnalysisSnapshots.find((snapshot) => snapshot.id === project?.latestAnalysisSnapshotId) ??
    state.projectAnalysisSnapshots
      .filter((snapshot) => snapshot.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  );
}

export function createProject(state: AppState, input: ProjectCreateInput, now = new Date().toISOString()): AppState {
  const project = ProjectSchema.parse({
    id: makeId("project"),
    workspaceId: state.workspace.id,
    name: input.name.trim(),
    slug: slugify(input.name),
    description: input.description?.trim() || undefined,
    category: input.category?.trim() || undefined,
    status: "active",
    priority: input.priority ?? "medium",
    progress: 0,
    currentFocus: input.currentFocus?.trim() || "Define first useful slice",
    nextExactStep: input.nextExactStep?.trim() || "Open the project and capture the next concrete step.",
    localFolderPath: `%PCC_PROJECTS%/${slugify(input.name)}`,
    lastOpenedAt: now,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return {
    ...state,
    projects: [project, ...state.projects],
    timelineEvents: [
      createTimelineEvent(
        state.workspace.id,
        project.id,
        "project.created",
        `Project created: ${project.name}`,
        "user",
        now,
        [{ entityType: "project", entityId: project.id, label: project.name }],
      ),
      ...state.timelineEvents,
    ],
  };
}

export function updateProjectStatus(
  state: AppState,
  projectId: string,
  status: ProjectStatus,
  now = new Date().toISOString(),
): AppState {
  const before = state.projects.find((project) => project.id === projectId);
  if (!before) return state;
  const after = { ...before, status, updatedAt: now, lastActivityAt: now, version: before.version + 1 };

  return {
    ...state,
    projects: state.projects.map((project) => (project.id === projectId ? after : project)),
    timelineEvents: [
      createTimelineEvent(state.workspace.id, projectId, "project.status_updated", `Status set to ${status}`, "user", now),
      ...state.timelineEvents,
    ],
  };
}

export function archiveProject(state: AppState, projectId: string, now = new Date().toISOString()): AppState {
  const before = state.projects.find((project) => project.id === projectId);
  if (!before) return state;
  const after = {
    ...before,
    status: "archived" as const,
    archivedAt: now,
    updatedAt: now,
    version: before.version + 1,
  };
  return {
    ...state,
    projects: state.projects.map((project) => (project.id === projectId ? after : project)),
    timelineEvents: [
      createTimelineEvent(state.workspace.id, projectId, "project.archived", `Archived ${before.name}`, "user", now),
      ...state.timelineEvents,
    ],
  };
}

export function restoreProject(state: AppState, projectId: string, now = new Date().toISOString()): AppState {
  const before = state.projects.find((project) => project.id === projectId);
  if (!before) return state;
  const after = {
    ...before,
    status: "active" as const,
    archivedAt: undefined,
    updatedAt: now,
    version: before.version + 1,
  };
  return {
    ...state,
    projects: state.projects.map((project) => (project.id === projectId ? after : project)),
    timelineEvents: [
      createTimelineEvent(state.workspace.id, projectId, "project.restored", `Restored ${before.name}`, "user", now),
      ...state.timelineEvents,
    ],
  };
}

export function getLatestResume(state: AppState, projectId: string): ResumeSnapshot | undefined {
  return state.resumeSnapshots
    .filter((resume) => resume.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function createBlocker(state: AppState, input: BlockerCreateInput, now = new Date().toISOString()): AppState {
  const blocker: Blocker = {
    id: makeId("blocker"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    severity: input.severity ?? "medium",
    status: "open",
    nextAction: input.nextAction?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return {
    ...state,
    blockers: [blocker, ...state.blockers],
    projects: state.projects.map((project) =>
      project.id === input.projectId
        ? { ...project, status: "blocked", updatedAt: now, lastActivityAt: now, version: project.version + 1 }
        : project,
    ),
    timelineEvents: [
      createTimelineEvent(
        state.workspace.id,
        input.projectId,
        "blocker.created",
        `Blocker created: ${blocker.title}`,
        "user",
        now,
        [{ entityType: "blocker", entityId: blocker.id, label: blocker.title }],
      ),
      ...state.timelineEvents,
    ],
  };
}

export function resolveBlocker(state: AppState, blockerId: string, now = new Date().toISOString()): AppState {
  const blocker = state.blockers.find((candidate) => candidate.id === blockerId);
  if (!blocker) return state;

  return {
    ...state,
    blockers: state.blockers.map((candidate) =>
      candidate.id === blockerId
        ? { ...candidate, status: "resolved", resolvedAt: now, updatedAt: now, version: candidate.version + 1 }
        : candidate,
    ),
    timelineEvents: [
      createTimelineEvent(
        state.workspace.id,
        blocker.projectId,
        "blocker.resolved",
        `Blocker resolved: ${blocker.title}`,
        "user",
        now,
        [{ entityType: "blocker", entityId: blocker.id, label: blocker.title }],
      ),
      ...state.timelineEvents,
    ],
    auditLogs: [
      createAuditLog(state.workspace.id, "resolve_blocker", "blocker", blocker.id, blocker, { ...blocker, status: "resolved" }, now),
      ...state.auditLogs,
    ],
  };
}

export function endSessionWithResume(state: AppState, input: SessionEndInput, now = new Date().toISOString()): AppState {
  const project = state.projects.find((candidate) => candidate.id === input.projectId);
  if (!project) return state;

  const session: Session = {
    id: makeId("session"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    title: `${project.name} session`,
    startedAt: now,
    endedAt: now,
    summary: input.summary.trim(),
    completedWork: input.completedWork ?? [],
    whatWorks: input.whatWorks ?? [],
    whatFailed: input.whatFailed ?? [],
    nextStep: input.nextStep.trim(),
    blockerIds: input.blockerIds ?? [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const resume = ResumeSnapshotSchema.parse({
    id: makeId("resume"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    source: "session",
    youStoppedHere: input.summary.trim(),
    nextExactStep: input.nextStep.trim(),
    currentFocus: project.currentFocus,
    activeBlockerIds: input.blockerIds ?? [],
    relevantAttachmentIds: [],
    relevantLocationIds: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return {
    ...state,
    sessions: [session, ...state.sessions],
    resumeSnapshots: [resume, ...state.resumeSnapshots],
    projects: state.projects.map((candidate) =>
      candidate.id === input.projectId
        ? {
            ...candidate,
            nextExactStep: resume.nextExactStep,
            progress: Math.min(100, candidate.progress + 5),
            status: input.blockerIds?.length ? "blocked" : "active",
            updatedAt: now,
            lastActivityAt: now,
            version: candidate.version + 1,
          }
        : candidate,
    ),
    timelineEvents: [
      createTimelineEvent(state.workspace.id, input.projectId, "resume.updated", "Resume snapshot updated", "user", now, [
        { entityType: "resumeSnapshot", entityId: resume.id, label: resume.nextExactStep },
      ]),
      createTimelineEvent(state.workspace.id, input.projectId, "session.ended", "Session ended", "user", now, [
        { entityType: "session", entityId: session.id, label: session.title },
      ]),
      ...state.timelineEvents,
    ],
  };
}

export function createAiResumeSuggestion(
  state: AppState,
  input: ResumeDraftInput,
  now = new Date().toISOString(),
): AppState {
  const before = getLatestResume(state, input.projectId);
  const after = {
    source: "assistant",
    youStoppedHere: input.youStoppedHere.trim(),
    nextExactStep: input.nextExactStep.trim(),
    currentFocus: input.currentFocus?.trim(),
    confidence: input.confidence ?? 0.72,
  };

  const approval: Approval = {
    id: makeId("approval"),
    workspaceId: state.workspace.id,
    status: "pending",
    title: "Apply AI resume snapshot",
    summary: "Assistant drafted an update to the project's restart context.",
    before,
    after,
    risk: "medium",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const suggestion: AISuggestion = {
    id: makeId("suggestion"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    source: "assistant",
    suggestionType: "resume_snapshot.update",
    status: "pending_approval",
    payload: after,
    explanation: "Resume changes affect canonical project memory and require review.",
    confidence: after.confidence,
    affectedEntityRefs: [{ entityType: "project", entityId: input.projectId }],
    approvalId: approval.id,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return {
    ...state,
    aiSuggestions: [suggestion, ...state.aiSuggestions],
    approvals: [{ ...approval, suggestionId: suggestion.id }, ...state.approvals],
    timelineEvents: [
      createTimelineEvent(state.workspace.id, input.projectId, "approval.created", approval.title, "assistant", now),
      ...state.timelineEvents,
    ],
  };
}

export function applyApproval(state: AppState, approvalId: string, now = new Date().toISOString()): AppState {
  const approval = state.approvals.find((candidate) => candidate.id === approvalId);
  const suggestion = state.aiSuggestions.find((candidate) => candidate.approvalId === approvalId);
  if (!approval || !suggestion || approval.status !== "pending") return state;

  if (suggestion.suggestionType !== "resume_snapshot.update" || !suggestion.projectId) return state;
  const payload = suggestion.payload as ResumeDraftInput;
  const project = state.projects.find((candidate) => candidate.id === suggestion.projectId);
  if (!project) return state;

  const resume = ResumeSnapshotSchema.parse({
    id: makeId("resume"),
    workspaceId: state.workspace.id,
    projectId: suggestion.projectId,
    source: "assistant",
    youStoppedHere: payload.youStoppedHere,
    nextExactStep: payload.nextExactStep,
    currentFocus: payload.currentFocus ?? project.currentFocus,
    confidence: payload.confidence,
    approvedAt: now,
    activeBlockerIds: state.blockers
      .filter((blocker) => blocker.projectId === suggestion.projectId && blocker.status !== "resolved")
      .map((blocker) => blocker.id),
    relevantAttachmentIds: [],
    relevantLocationIds: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  return {
    ...state,
    resumeSnapshots: [resume, ...state.resumeSnapshots],
    projects: state.projects.map((candidate) =>
      candidate.id === suggestion.projectId
        ? {
            ...candidate,
            currentFocus: resume.currentFocus,
            nextExactStep: resume.nextExactStep,
            updatedAt: now,
            lastActivityAt: now,
            version: candidate.version + 1,
          }
        : candidate,
    ),
    approvals: state.approvals.map((candidate) =>
      candidate.id === approvalId
        ? { ...candidate, status: "applied", approvedAt: now, approvedBy: "local-user", updatedAt: now, version: candidate.version + 1 }
        : candidate,
    ),
    aiSuggestions: state.aiSuggestions.map((candidate) =>
      candidate.id === suggestion.id
        ? { ...candidate, status: "applied", updatedAt: now, version: candidate.version + 1 }
        : candidate,
    ),
    auditLogs: [
      createAuditLog(state.workspace.id, "apply_resume_snapshot", "resumeSnapshot", resume.id, approval.before, resume, now, approvalId),
      ...state.auditLogs,
    ],
    timelineEvents: [
      createTimelineEvent(state.workspace.id, suggestion.projectId, "resume.updated", "AI resume snapshot applied", "assistant", now, [
        { entityType: "resumeSnapshot", entityId: resume.id, label: resume.nextExactStep },
      ]),
      ...state.timelineEvents,
    ],
  };
}

export function rejectApproval(
  state: AppState,
  approvalId: string,
  reason = "Rejected by user",
  now = new Date().toISOString(),
): AppState {
  const approval = state.approvals.find((candidate) => candidate.id === approvalId);
  const suggestion = state.aiSuggestions.find((candidate) => candidate.approvalId === approvalId);
  if (!approval) return state;

  return {
    ...state,
    approvals: state.approvals.map((candidate) =>
      candidate.id === approvalId
        ? { ...candidate, status: "rejected", rejectedReason: reason, updatedAt: now, version: candidate.version + 1 }
        : candidate,
    ),
    aiSuggestions: state.aiSuggestions.map((candidate) =>
      candidate.id === suggestion?.id ? { ...candidate, status: "rejected", updatedAt: now, version: candidate.version + 1 } : candidate,
    ),
    timelineEvents: [
      createTimelineEvent(state.workspace.id, suggestion?.projectId, "approval.rejected", approval.title, "user", now),
      ...state.timelineEvents,
    ],
  };
}

export function importFileToProject(state: AppState, input: FileImportInput, now = new Date().toISOString()): AppState {
  const project = state.projects.find((candidate) => candidate.id === input.projectId);
  if (!project) return state;

  const hash = input.hash ?? `${input.originalName}:${input.sizeBytes}`;
  const duplicate = state.attachments.find((attachment) => attachment.projectId === input.projectId && attachment.hash === hash);
  if (duplicate) {
    return {
      ...state,
      timelineEvents: [
        createTimelineEvent(state.workspace.id, input.projectId, "attachment.duplicate_detected", `Duplicate skipped: ${input.originalName}`, "system", now),
        ...state.timelineEvents,
      ],
    };
  }

  const attachment: Attachment = {
    id: makeId("attachment"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    title: input.originalName,
    category: input.category,
    storageMode: "copied_local",
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    hash,
    localPath: `${project.localFolderPath ?? `%PCC_PROJECTS%/${project.slug}`}/${input.category}/${input.originalName}`,
    originalPath: input.originalPath,
    indexedAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const location: Location = {
    id: makeId("location"),
    workspaceId: state.workspace.id,
    projectId: input.projectId,
    label: input.originalName,
    type: "file",
    pathOrUrl: attachment.localPath ?? input.originalName,
    description: `Imported ${input.category} file`,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return {
    ...state,
    attachments: [attachment, ...state.attachments],
    locations: [location, ...state.locations],
    timelineEvents: [
      createTimelineEvent(state.workspace.id, input.projectId, "attachment.imported", `File imported: ${input.originalName}`, "user", now, [
        { entityType: "attachment", entityId: attachment.id, label: attachment.title },
      ]),
      ...state.timelineEvents,
    ],
  };
}

export function activeOpenBlockers(state: AppState, projectId: string): Blocker[] {
  return state.blockers.filter((blocker) => blocker.projectId === projectId && !["resolved", "ignored"].includes(blocker.status));
}

export function projectTimeline(state: AppState, projectId: string): TimelineEvent[] {
  return state.timelineEvents.filter((event) => event.projectId === projectId).slice(0, 12);
}

function createTimelineEvent(
  workspaceId: string,
  projectId: string | undefined,
  eventType: string,
  title: string,
  actorType: TimelineEvent["actorType"],
  createdAt: string,
  entityRefs: TimelineEvent["entityRefs"] = [],
): TimelineEvent {
  return {
    id: makeId("event"),
    workspaceId,
    projectId,
    eventType,
    actorType,
    title,
    entityRefs,
    createdAt,
  };
}

function createAuditLog(
  workspaceId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  createdAt: string,
  approvalId?: string,
): AuditLog {
  return {
    id: makeId("audit"),
    workspaceId,
    actorType: "user",
    action,
    entityType,
    entityId,
    before,
    after,
    approvalId,
    createdAt,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizePathForCompare(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
