import type { ProjectProfile } from "./pccProjectProfile.types";

export const mockProjectProfile: ProjectProfile = {
  id: "aurora-design-os",
  name: "AURORA DESIGN OS",
  oneLiner: "Local-first desktop app for repo, design and patch intelligence.",
  category: "app",
  status: "building",
  healthScore: 82,
  progressPercent: 46,
  momentum: "active",
  qaStatus: "needs_review",
  lastActiveAt: "Today",

  currentGoal: "Finish the safe patch proposal workflow.",
  whyItMatters: "This unlocks trusted repo changes without full autonomy.",
  nextAction: "Design the approval modal with files affected, risk, rollback and tests.",
  nextMilestone: "Desktop V1 skeleton",

  blockers: [
    {
      id: "sandbox-ui",
      title: "No final sandbox approval UI yet",
      severity: "medium",
      recommendedAction: "Create approval rail and modal before implementing write actions.",
    },
  ],

  workstreams: [
    {
      id: "product",
      name: "Product",
      status: "active",
      progressPercent: 72,
      nextStep: "Finalize project profile information hierarchy.",
      colorToken: "--pcc-proj-green",
    },
    {
      id: "ux-ui",
      name: "UX/UI",
      status: "active",
      progressPercent: 64,
      nextStep: "Implement Warm Dark Command Center profile layout.",
      colorToken: "--pcc-proj-purple",
    },
    {
      id: "code",
      name: "Code",
      status: "not_started",
      progressPercent: 18,
      nextStep: "Create typed ProjectProfile model and mock data.",
      colorToken: "--pcc-proj-blue",
    },
    {
      id: "security",
      name: "Security",
      status: "blocked",
      progressPercent: 34,
      nextStep: "Define approval gates and rollback behavior.",
      colorToken: "--pcc-proj-red",
    },
    {
      id: "qa",
      name: "QA",
      status: "not_started",
      progressPercent: 10,
      nextStep: "Create EPIC readiness checklist.",
      colorToken: "--pcc-proj-yellow",
    },
  ],

  decisions: [
    {
      id: "local-first",
      title: "V1 will be local-first desktop, not cloud SaaS.",
      rationale: "Trust, repo access and safe patching require a local runtime.",
      status: "approved",
      date: "2026-05-27",
    },
    {
      id: "manual-approval",
      title: "No silent file writes or shell execution.",
      rationale: "User trust depends on explicit approval before risky actions.",
      status: "approved",
      date: "2026-05-27",
    },
  ],

  risks: [
    {
      id: "approval-risk",
      title: "Patch workflow may feel unsafe without clear approval states.",
      level: "medium",
      mitigation: "Show files, risk, why needed, rollback and tests before any apply action.",
    },
  ],

  artifacts: [
    {
      id: "product-spec",
      label: "Product Spec",
      type: "spec",
      updatedAt: "Today",
    },
    {
      id: "sandbox-policy",
      label: "Sandbox Policy",
      type: "note",
      updatedAt: "Today",
    },
    {
      id: "codex-prompt",
      label: "Codex Prompt",
      type: "prompt",
      updatedAt: "Today",
    },
  ],

  recentActivity: [
    {
      id: "activity-1",
      date: "Today",
      event: "Defined Warm Dark Command Center design tokens.",
      type: "decision",
    },
    {
      id: "activity-2",
      date: "Today",
      event: "Prioritized Current Focus and Next Action for profile layout.",
      type: "note",
    },
  ],

  milestones: [
    { id: "idea", label: "Idea", status: "done" },
    { id: "spec", label: "Spec", status: "done" },
    { id: "design", label: "Design", status: "current" },
    { id: "build", label: "Build", status: "upcoming" },
    { id: "test", label: "Test", status: "upcoming" },
    { id: "launch", label: "Launch", status: "upcoming" },
  ],
};
