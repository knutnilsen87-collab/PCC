export const designTokens = {
  color: {
    background: "#080b10",
    panel: "#10161f",
    panelRaised: "#151c27",
    border: "#273142",
    text: "#f4efe7",
    muted: "#9aa7b7",
    accent: "#6fb7d8",
    assistant: "#9f8cff",
    success: "#75c593",
    warning: "#d6a45d",
    danger: "#df7770",
  },
  radius: {
    panel: "8px",
    control: "6px",
  },
  shadow: {
    subtle: "0 18px 60px rgba(0,0,0,0.24)",
  },
} as const;

export const statusLabels = {
  idea: "Idea",
  active: "Active",
  paused: "Paused",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
} as const;
