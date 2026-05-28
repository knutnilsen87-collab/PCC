export type ProjectStatus = "idea" | "planning" | "building" | "testing" | "launched" | "paused";

export type RiskLevel = "low" | "medium" | "high";
export type WorkstreamStatus = "not_started" | "active" | "blocked" | "done";
export type DecisionStatus = "pending" | "approved" | "rejected";
export type ArtifactType = "spec" | "design" | "repo" | "prompt" | "qa" | "note" | "file";

export interface ProjectBlocker {
  id: string;
  title: string;
  severity: RiskLevel;
  recommendedAction: string;
}

export interface ProjectWorkstream {
  id: string;
  name: string;
  status: WorkstreamStatus;
  progressPercent: number;
  nextStep: string;
  colorToken?: string;
}

export interface ProjectDecision {
  id: string;
  title: string;
  rationale: string;
  status: DecisionStatus;
  date: string;
}

export interface ProjectRisk {
  id: string;
  title: string;
  level: RiskLevel;
  mitigation: string;
}

export interface ProjectArtifact {
  id: string;
  label: string;
  type: ArtifactType;
  href?: string;
  updatedAt?: string;
}

export interface ProjectActivityEvent {
  id: string;
  date: string;
  event: string;
  type?: "note" | "decision" | "task" | "qa" | "patch";
}

export interface ProjectMilestone {
  id: string;
  label: string;
  status: "done" | "current" | "upcoming" | "blocked";
  description?: string;
}

export interface ProjectProfile {
  id: string;
  name: string;
  oneLiner: string;
  category: "app" | "game" | "brand" | "client" | "research" | "system";
  status: ProjectStatus;
  healthScore: number;
  progressPercent: number;
  momentum: "active" | "slow" | "stalled" | "paused";
  qaStatus: "not_checked" | "needs_review" | "pass" | "fail";
  lastActiveAt: string;

  currentGoal: string;
  whyItMatters: string;
  nextAction: string;
  nextMilestone: string;

  blockers: ProjectBlocker[];
  workstreams: ProjectWorkstream[];
  decisions: ProjectDecision[];
  risks: ProjectRisk[];
  artifacts: ProjectArtifact[];
  recentActivity: ProjectActivityEvent[];
  milestones: ProjectMilestone[];
}
