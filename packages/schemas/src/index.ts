import { z } from "zod";

export const IdSchema = z.string().min(1);
export const IsoDateSchema = z.string().datetime();

export const ProjectStatusSchema = z.enum([
  "idea",
  "active",
  "paused",
  "blocked",
  "completed",
  "archived",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "edited",
  "rejected",
  "expired",
  "applied",
  "failed",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const SuggestionStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "applied",
  "failed",
]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

export const AttachmentCategorySchema = z.enum([
  "docs",
  "assets",
  "prompts",
  "references",
  "exports",
  "sessions",
  "screenshots",
  "source",
  "other",
]);
export type AttachmentCategory = z.infer<typeof AttachmentCategorySchema>;

export const StorageModeSchema = z.enum([
  "copied_local",
  "referenced_local",
  "uploaded_server",
  "external_url",
]);
export type StorageMode = z.infer<typeof StorageModeSchema>;

export const EntityRefSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  label: z.string().optional(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

const VersionedEntitySchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  deletedAt: IsoDateSchema.nullish(),
  version: z.number().int().nonnegative(),
});

export const WorkspaceSettingsSchema = z.object({
  assistantEnabled: z.boolean().default(true),
  localPersistence: z.enum(["browser_local", "sqlite_pending"]).default("browser_local"),
  reducedMotion: z.boolean().default(false),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export const WorkspaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  ownerUserId: z.string().min(1),
  localRootPath: z.string().optional(),
  settings: WorkspaceSettingsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  version: z.number().int().nonnegative(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ProjectSchema = VersionedEntitySchema.extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  status: ProjectStatusSchema,
  priority: PrioritySchema,
  progress: z.number().min(0).max(100),
  currentPhase: z.string().optional(),
  currentFocus: z.string().optional(),
  nextExactStep: z.string().optional(),
  localFolderPath: z.string().optional(),
  lastOpenedAt: IsoDateSchema.optional(),
  lastActivityAt: IsoDateSchema.optional(),
  archivedAt: IsoDateSchema.optional(),
  origin: z.enum(["manual", "local_folder_import", "template", "remote_repo"]).optional(),
  primaryLocationId: IdSchema.optional(),
  latestAnalysisSnapshotId: IdSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ResumeSnapshotSchema = VersionedEntitySchema.extend({
  projectId: IdSchema,
  source: z.enum(["manual", "session", "assistant", "import"]),
  youStoppedHere: z.string().min(1),
  nextExactStep: z.string().min(1),
  currentFocus: z.string().optional(),
  activeBlockerIds: z.array(IdSchema),
  relevantAttachmentIds: z.array(IdSchema),
  relevantLocationIds: z.array(IdSchema),
  doNot: z.array(z.string()).optional(),
  codexPrompt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  approvedAt: IsoDateSchema.optional(),
});
export type ResumeSnapshot = z.infer<typeof ResumeSnapshotSchema>;

export const SessionSchema = VersionedEntitySchema.extend({
  projectId: IdSchema,
  title: z.string().optional(),
  startedAt: IsoDateSchema,
  endedAt: IsoDateSchema.optional(),
  summary: z.string().optional(),
  completedWork: z.array(z.string()).optional(),
  changedFiles: z.array(z.string()).optional(),
  whatWorks: z.array(z.string()).optional(),
  whatFailed: z.array(z.string()).optional(),
  nextStep: z.string().optional(),
  blockerIds: z.array(IdSchema).optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const BlockerSchema = VersionedEntitySchema.extend({
  projectId: IdSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "investigating", "waiting", "resolved", "ignored"]),
  nextAction: z.string().optional(),
  owner: z.string().optional(),
  resolvedAt: IsoDateSchema.optional(),
});
export type Blocker = z.infer<typeof BlockerSchema>;

export const NoteSchema = VersionedEntitySchema.extend({
  projectId: IdSchema.optional(),
  body: z.string().min(1),
  source: z.enum(["manual", "assistant", "import"]).default("manual"),
});
export type Note = z.infer<typeof NoteSchema>;

export const DecisionSchema = VersionedEntitySchema.extend({
  projectId: IdSchema.optional(),
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().optional(),
  alternativesConsidered: z.array(z.string()).optional(),
  impact: z.string().optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const AttachmentSchema = VersionedEntitySchema.extend({
  projectId: IdSchema,
  sessionId: IdSchema.optional(),
  title: z.string().min(1),
  category: AttachmentCategorySchema,
  storageMode: StorageModeSchema,
  originalName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  hash: z.string().optional(),
  localPath: z.string().optional(),
  originalPath: z.string().optional(),
  url: z.string().url().optional(),
  indexedAt: IsoDateSchema.optional(),
  summary: z.string().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const LocationSchema = VersionedEntitySchema.extend({
  projectId: IdSchema,
  label: z.string().min(1),
  type: z.enum(["local_folder", "repo", "folder", "file", "url", "prompt", "design", "doc", "other"]),
  pathOrUrl: z.string().min(1),
  accessMode: z.enum(["read_only", "read_write_pending_approval", "read_write"]).optional(),
  isPrimary: z.boolean().optional(),
  description: z.string().optional(),
});
export type Location = z.infer<typeof LocationSchema>;

export const AnalysisWarningSchema = z.object({
  code: z.enum([
    "partial_scan",
    "large_folder",
    "permission_denied",
    "secret_files_skipped",
    "unknown_stack",
    "git_unavailable",
    "binary_files_skipped",
  ]),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]),
});
export type AnalysisWarning = z.infer<typeof AnalysisWarningSchema>;

export const SkippedPathSummarySchema = z.object({
  reason: z.enum([
    "ignored_by_policy",
    "gitignored",
    "secret_denied",
    "too_large",
    "binary",
    "permission_denied",
    "outside_root",
  ]),
  count: z.number().int().nonnegative(),
  examples: z.array(z.string()).optional(),
});
export type SkippedPathSummary = z.infer<typeof SkippedPathSummarySchema>;

export const ProjectAnalysisSnapshotSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  projectId: IdSchema,
  locationId: IdSchema,
  createdAt: IsoDateSchema,
  scanPolicyVersion: z.string().min(1),
  analysisVersion: z.string().min(1),
  status: z.enum(["complete", "partial", "failed"]),
  summary: z.object({
    detectedName: z.string().min(1),
    likelyPurpose: z.string().optional(),
    likelyProjectType: z.enum([
      "web_app",
      "desktop_app",
      "mobile_app",
      "api_service",
      "library",
      "documentation",
      "data_project",
      "unknown",
    ]),
    confidence: z.number().min(0).max(1),
    shortSummary: z.string().min(1),
    statusSummary: z.string().min(1),
  }),
  repo: z
    .object({
      isGitRepo: z.boolean(),
      branch: z.string().optional(),
      latestCommit: z
        .object({
          hash: z.string(),
          message: z.string(),
          author: z.string().optional(),
          date: z.string().optional(),
        })
        .optional(),
      changedFiles: z.array(
        z.object({
          path: z.string(),
          status: z.enum(["added", "modified", "deleted", "renamed", "unknown"]),
        }),
      ),
      hasUncommittedChanges: z.boolean(),
    })
    .nullable(),
  stack: z.object({
    detectedLanguages: z.array(z.string()),
    detectedFrameworks: z.array(z.string()),
    packageManagers: z.array(z.string()),
    configFiles: z.array(z.string()),
    scripts: z.array(
      z.object({
        name: z.string(),
        command: z.string(),
        category: z.enum(["dev", "build", "test", "lint", "format", "unknown"]),
      }),
    ),
  }),
  docs: z.object({
    readmeFiles: z.array(z.string()),
    docsFolders: z.array(z.string()),
    statusFiles: z.array(z.string()),
    planningFiles: z.array(z.string()),
    summarizedDocs: z.array(
      z.object({
        path: z.string(),
        title: z.string().optional(),
        safeSummary: z.string(),
      }),
    ),
  }),
  files: z.object({
    totalFilesSeen: z.number().int().nonnegative(),
    totalFilesScanned: z.number().int().nonnegative(),
    totalFilesSkipped: z.number().int().nonnegative(),
    importantFiles: z.array(
      z.object({
        path: z.string(),
        reason: z.string(),
        category: z.enum(["entrypoint", "config", "docs", "test", "package", "workflow", "source", "unknown"]),
      }),
    ),
    recentFiles: z.array(z.object({ path: z.string(), modifiedAt: z.string() })),
    todoMarkers: z.array(z.object({ path: z.string(), count: z.number().int().nonnegative() })),
  }),
  risks: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["info", "low", "medium", "high"]),
      title: z.string(),
      explanation: z.string(),
      suggestedAction: z.string().optional(),
    }),
  ),
  blockers: z.array(
    z.object({
      title: z.string(),
      evidence: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      recommendedAction: z.string().optional(),
    }),
  ),
  recommendedNextStep: z.string().nullable(),
  assistantContextSummary: z.string(),
  warnings: z.array(AnalysisWarningSchema),
  skipped: z.array(SkippedPathSummarySchema),
});
export type ProjectAnalysisSnapshot = z.infer<typeof ProjectAnalysisSnapshotSchema>;

export const AISuggestionSchema = VersionedEntitySchema.extend({
  projectId: IdSchema.optional(),
  source: z.string().min(1),
  suggestionType: z.string().min(1),
  status: SuggestionStatusSchema,
  payload: z.unknown(),
  explanation: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  affectedEntityRefs: z.array(EntityRefSchema),
  approvalId: IdSchema.optional(),
});
export type AISuggestion = z.infer<typeof AISuggestionSchema>;

export const ApprovalSchema = VersionedEntitySchema.extend({
  suggestionId: IdSchema.optional(),
  status: ApprovalStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  approvedBy: z.string().optional(),
  approvedAt: IsoDateSchema.optional(),
  rejectedReason: z.string().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const TimelineEventSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  projectId: IdSchema.optional(),
  eventType: z.string().min(1),
  actorType: z.enum(["user", "assistant", "system"]),
  actorId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  entityRefs: z.array(EntityRefSchema),
  metadata: z.record(z.unknown()).optional(),
  createdAt: IsoDateSchema,
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const AuditLogSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  actorType: z.enum(["user", "assistant", "system"]),
  actorId: z.string().optional(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  approvalId: IdSchema.optional(),
  correlationId: z.string().optional(),
  createdAt: IsoDateSchema,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AssistantToolRegistrationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  approvalRequired: z.enum(["never", "sometimes", "always"]),
  auditRequired: z.boolean(),
  moduleId: z.string().min(1),
});
export type AssistantToolRegistration = z.infer<typeof AssistantToolRegistrationSchema>;
