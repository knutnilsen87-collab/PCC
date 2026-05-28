import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  FileText,
  Gauge,
  Milestone,
  Play,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { mockProjectProfile } from "./pccProjectProfile.mock";
import type {
  ArtifactType,
  DecisionStatus,
  ProjectActivityEvent,
  ProjectArtifact,
  ProjectBlocker,
  ProjectDecision,
  ProjectMilestone,
  ProjectProfile,
  ProjectRisk,
  ProjectStatus,
  ProjectWorkstream,
  RiskLevel,
  WorkstreamStatus,
} from "./pccProjectProfile.types";

type ProjectProfilePageState = "ready" | "loading" | "empty" | "error";

export interface ProjectProfilePageProps {
  profile?: ProjectProfile;
  state?: ProjectProfilePageState;
  onContinue?: () => void;
  onCommand?: (command: string) => void;
  onCreateProject?: () => void;
  onRetry?: () => void;
}

const suggestedCommands = ["/product_diagnosis", "/design_audit", "/patch_plan", "/epic_gate", "/export_spec"];

export function ProjectProfilePage({
  profile = mockProjectProfile,
  state = "ready",
  onContinue,
  onCommand,
  onCreateProject,
  onRetry,
}: ProjectProfilePageProps) {
  if (state === "loading") return <ProjectProfileLoadingState />;
  if (state === "empty") return <ProjectProfileEmptyState onCreateProject={onCreateProject} />;
  if (state === "error") return <ProjectProfileErrorState onRetry={onRetry} />;

  return (
    <section className="pcc-profile-page" aria-label={`${profile.name} project profile`}>
      <ProjectProfileHeader profile={profile} onContinue={onContinue} />
      <div className="pcc-profile-content">
        <aside className="pcc-left-column" aria-label="Project snapshot">
          <ProjectSnapshotCard profile={profile} />
          <ProjectVitalSigns profile={profile} />
          <ArtifactsPanel artifacts={profile.artifacts} />
          <RecentActivityPanel activity={profile.recentActivity} />
        </aside>

        <main className="pcc-main-column" aria-label="Project focus">
          <CurrentFocusCard profile={profile} />
          <MilestoneMap milestones={profile.milestones} />
          <WorkstreamGrid workstreams={profile.workstreams} />
          <div className="pcc-profile-split">
            <DecisionsPanel decisions={profile.decisions} />
            <RisksPanel risks={profile.risks} blockers={profile.blockers} />
          </div>
        </main>

        <aside className="pcc-right-rail" aria-label="Project actions">
          <NextActionRail profile={profile} onContinue={onContinue} />
        </aside>
      </div>
      <AICommandBar onCommand={onCommand} />
    </section>
  );
}

export function ProjectProfileHeader({ profile, onContinue }: { profile: ProjectProfile; onContinue?: () => void }) {
  return (
    <header className="pcc-profile-header">
      <div>
        <span className="pcc-eyebrow">Project Profile</span>
        <h2>{profile.name}</h2>
        <p>{profile.oneLiner}</p>
        <div className="pcc-header-meta" aria-label="Project status summary">
          <StatusBadge status={profile.status} />
          <span>Health {profile.healthScore}/100</span>
          <span>Progress {profile.progressPercent}%</span>
          <span>Last active {profile.lastActiveAt}</span>
        </div>
      </div>
      <button type="button" className="pcc-button-primary pcc-header-cta" onClick={onContinue}>
        <Play size={16} /> Continue Project
      </button>
    </header>
  );
}

export function ProjectSnapshotCard({ profile }: { profile: ProjectProfile }) {
  return (
    <section className="pcc-card pcc-snapshot-card" aria-label="Project identity">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Identity</span>
        <span className="pcc-chip">{profile.category}</span>
      </div>
      <h3 className="pcc-card-title">{profile.name}</h3>
      <p className="pcc-card-description">{profile.oneLiner}</p>
      <div className="pcc-snapshot-facts">
        <div>
          <span>Milestone</span>
          <strong>{profile.nextMilestone}</strong>
        </div>
        <div>
          <span>Momentum</span>
          <strong>{labelize(profile.momentum)}</strong>
        </div>
      </div>
    </section>
  );
}

export function ProjectVitalSigns({ profile }: { profile: ProjectProfile }) {
  const riskLevel = getHighestRisk(profile.risks, profile.blockers);
  return (
    <section className="pcc-card pcc-vital-signs" aria-label="Vital signs">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Vital Signs</span>
        <Gauge size={16} aria-hidden="true" />
      </div>
      <div className="pcc-vital-grid">
        <VitalSign label="Progress" value={`${profile.progressPercent}%`}>
          <ProgressBar value={profile.progressPercent} />
        </VitalSign>
        <VitalSign label="Momentum" value={labelize(profile.momentum)} tone={profile.momentum === "active" ? "good" : "warn"} />
        <VitalSign label="Risk" value={labelize(riskLevel)} tone={riskLevel === "high" ? "danger" : riskLevel === "medium" ? "warn" : "good"} />
        <VitalSign label="QA" value={labelize(profile.qaStatus)} tone={profile.qaStatus === "fail" ? "danger" : profile.qaStatus === "pass" ? "good" : "warn"} />
        <VitalSign label="Decisions" value={`${profile.decisions.length}`} />
        <VitalSign label="Next milestone" value={profile.nextMilestone} />
      </div>
    </section>
  );
}

function VitalSign({ label, value, tone, children }: { label: string; value: string; tone?: "good" | "warn" | "danger"; children?: ReactNode }) {
  return (
    <div className={`pcc-vital-card ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </div>
  );
}

export function CurrentFocusCard({ profile }: { profile: ProjectProfile }) {
  const topBlocker = profile.blockers[0];
  return (
    <section className="pcc-card pcc-current-focus-card" tabIndex={-1} id="pcc-current-focus">
      <span className="pcc-eyebrow">Current Focus</span>
      <h3>{profile.currentGoal || "No current goal defined yet."}</h3>
      <p>{profile.whyItMatters || "Add a current focus to make this project easier to continue."}</p>
      <div className="pcc-next-step-box">
        <span>Next step</span>
        <strong>{profile.nextAction || "Define the next best action."}</strong>
      </div>
      {topBlocker && (
        <div className="pcc-blocker-summary">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            Blocker: <strong>{topBlocker.title}</strong>
          </span>
        </div>
      )}
    </section>
  );
}

export function NextActionRail({ profile, onContinue }: { profile: ProjectProfile; onContinue?: () => void }) {
  const topBlocker = profile.blockers[0];
  const pendingDecisions = profile.decisions.filter((decision) => decision.status === "pending").length;
  const topRisk = getHighestRisk(profile.risks, profile.blockers);

  return (
    <section className="pcc-card pcc-next-action-rail">
      <span className="pcc-eyebrow">Next Action</span>
      <h3>{profile.nextAction}</h3>
      <p>Start with the smallest useful move that advances the current milestone.</p>
      <button type="button" className="pcc-button-primary" onClick={onContinue}>
        <ArrowRight size={16} /> Start Next Action
      </button>
      <div className="pcc-rail-facts">
        <RailFact label="Risk level" value={labelize(topRisk)} tone={topRisk} />
        <RailFact label="Top blocker" value={topBlocker?.title ?? "No active blocker"} tone={topBlocker ? topBlocker.severity : "low"} />
        <RailFact label="Pending decisions" value={`${pendingDecisions}`} />
        <RailFact label="Suggested command" value="/epic_gate" />
      </div>
      <button type="button" className="pcc-button-secondary">
        Review Blocker
      </button>
      <button type="button" className="pcc-button-secondary">
        Run EPIC Check
      </button>
    </section>
  );
}

function RailFact({ label, value, tone }: { label: string; value: string; tone?: RiskLevel }) {
  return (
    <div className={`pcc-rail-fact ${tone ? `risk-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function MilestoneMap({ milestones }: { milestones: ProjectMilestone[] }) {
  return (
    <section className="pcc-card pcc-milestone-map">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Milestone Map</span>
        <Milestone size={16} aria-hidden="true" />
      </div>
      <ol>
        {milestones.map((milestone) => (
          <li key={milestone.id} className={`milestone-${milestone.status}`}>
            <span aria-hidden="true">{milestone.status === "done" ? <Check size={14} /> : <Circle size={13} />}</span>
            <strong>{milestone.label}</strong>
            {milestone.description && <small>{milestone.description}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function WorkstreamGrid({ workstreams }: { workstreams: ProjectWorkstream[] }) {
  return (
    <section className="pcc-card pcc-workstream-panel">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Workstreams</span>
        <span className="pcc-chip">{workstreams.length} active lanes</span>
      </div>
      <div className="pcc-workstream-grid">
        {workstreams.map((workstream) => (
          <article
            key={workstream.id}
            className="pcc-workstream-card"
            style={{ "--workstream-color": `var(${workstream.colorToken ?? "--pcc-accent-primary"})` } as CSSProperties}
          >
            <div>
              <span className="pcc-color-dot" aria-hidden="true" />
              <strong>{workstream.name}</strong>
              <StatusBadge status={workstream.status} />
            </div>
            <ProgressBar value={workstream.progressPercent} color="var(--workstream-color)" />
            <p>{workstream.nextStep}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DecisionsPanel({ decisions }: { decisions: ProjectDecision[] }) {
  return (
    <section className="pcc-card pcc-decisions-panel">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Decisions</span>
        <span className="pcc-chip">Project memory</span>
      </div>
      <ul className="pcc-profile-list">
        {decisions.slice(0, 4).map((decision) => (
          <li key={decision.id}>
            <div>
              <strong>{decision.title}</strong>
              <StatusBadge status={decision.status} />
            </div>
            <p>{decision.rationale}</p>
            <small>{decision.date}</small>
          </li>
        ))}
        {!decisions.length && <li>No decisions captured yet.</li>}
      </ul>
    </section>
  );
}

export function RisksPanel({ risks, blockers }: { risks: ProjectRisk[]; blockers: ProjectBlocker[] }) {
  return (
    <section className="pcc-card pcc-risks-panel">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Risks & Blockers</span>
        <AlertTriangle size={16} aria-hidden="true" />
      </div>
      <ul className="pcc-risk-list">
        {blockers.map((blocker) => (
          <li key={blocker.id} className={`risk-${blocker.severity}`}>
            <strong>{blocker.title}</strong>
            <span>{labelize(blocker.severity)} blocker</span>
            <p>{blocker.recommendedAction}</p>
          </li>
        ))}
        {risks.map((risk) => (
          <li key={risk.id} className={`risk-${risk.level}`}>
            <strong>{risk.title}</strong>
            <span>{labelize(risk.level)} risk</span>
            <p>{risk.mitigation}</p>
          </li>
        ))}
        {!risks.length && !blockers.length && <li className="risk-low">No active risks or blockers.</li>}
      </ul>
    </section>
  );
}

export function ArtifactsPanel({ artifacts }: { artifacts: ProjectArtifact[] }) {
  return (
    <section className="pcc-card pcc-artifacts-panel">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Artifacts</span>
        <FileText size={16} aria-hidden="true" />
      </div>
      <ul className="pcc-artifact-list">
        {artifacts.slice(0, 6).map((artifact) => (
          <li key={artifact.id}>
            <span>{artifactIconLabel(artifact.type)}</span>
            <strong>{artifact.label}</strong>
            <small>{artifact.updatedAt ?? "Not indexed"}</small>
          </li>
        ))}
        {!artifacts.length && <li>No artifacts linked yet.</li>}
      </ul>
    </section>
  );
}

export function RecentActivityPanel({ activity }: { activity: ProjectActivityEvent[] }) {
  return (
    <section className="pcc-card pcc-activity-panel">
      <div className="pcc-section-heading">
        <span className="pcc-eyebrow">Recent Activity</span>
        <Clock3 size={16} aria-hidden="true" />
      </div>
      <ol className="pcc-activity-list">
        {activity.slice(0, 8).map((event) => (
          <li key={event.id}>
            <span>{event.date}</span>
            <strong>{event.event}</strong>
          </li>
        ))}
        {!activity.length && <li>No recent project activity.</li>}
      </ol>
    </section>
  );
}

export function AICommandBar({ onCommand }: { onCommand?: (command: string) => void }) {
  const [command, setCommand] = useState("");
  const [lastCommand, setLastCommand] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCommand = command.trim();
    if (!nextCommand) return;
    onCommand?.(nextCommand);
    if (!onCommand) console.info("PCC project command:", nextCommand);
    setLastCommand(nextCommand);
    setCommand("");
  }

  return (
    <form className="pcc-ai-command-bar" onSubmit={submit}>
      <div className="pcc-command-suggestions" aria-label="Suggested PCC commands">
        {suggestedCommands.map((suggestion) => (
          <button type="button" key={suggestion} className="pcc-command-chip" onClick={() => setCommand(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <div className="pcc-command-input-row">
        <Sparkles size={17} aria-hidden="true" />
        <input
          aria-label="Ask PCC about this project"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Ask PCC about this project or type /command..."
        />
        <button type="submit" className="pcc-button-primary">
          Run
        </button>
      </div>
      {lastCommand && <span className="pcc-command-feedback">Queued {lastCommand}. No project mutation runs without approval.</span>}
    </form>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus | WorkstreamStatus | DecisionStatus }) {
  return <span className={`pcc-chip status-${status}`}>{labelize(status)}</span>;
}

export function ProgressBar({ value, color = "var(--pcc-accent-primary)" }: { value: number; color?: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="pcc-progress-track" aria-label={`${normalized}% complete`} role="progressbar" aria-valuenow={normalized} aria-valuemin={0} aria-valuemax={100}>
      <div className="pcc-progress-fill" style={{ width: `${normalized}%`, background: color }} />
    </div>
  );
}

function ProjectProfileLoadingState() {
  return (
    <section className="pcc-profile-page pcc-profile-state">
      <div className="pcc-card pcc-skeleton-card">
        <span className="pcc-eyebrow">Loading project profile...</span>
        <div />
        <div />
        <div />
      </div>
    </section>
  );
}

function ProjectProfileEmptyState({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <section className="pcc-profile-page pcc-profile-state">
      <div className="pcc-card pcc-empty-profile">
        <h2>No project selected</h2>
        <p>Choose a project from the sidebar or create a new one.</p>
        <button type="button" className="pcc-button-primary" onClick={onCreateProject}>
          Create Project
        </button>
      </div>
    </section>
  );
}

function ProjectProfileErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <section className="pcc-profile-page pcc-profile-state">
      <div className="pcc-card pcc-empty-profile">
        <h2>Could not load project profile.</h2>
        <p>Retry or open project settings.</p>
        <button type="button" className="pcc-button-secondary" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  );
}

function getHighestRisk(risks: ProjectRisk[], blockers: ProjectBlocker[]): RiskLevel {
  const levels = [...risks.map((risk) => risk.level), ...blockers.map((blocker) => blocker.severity)];
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function artifactIconLabel(type: ArtifactType): string {
  const labels: Record<ArtifactType, string> = {
    spec: "Spec",
    design: "Design",
    repo: "Repo",
    prompt: "Prompt",
    qa: "QA",
    note: "Note",
    file: "File",
  };
  return labels[type];
}
