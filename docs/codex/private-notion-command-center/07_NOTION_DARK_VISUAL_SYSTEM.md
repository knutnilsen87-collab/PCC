# SPEC 07 — Notion Dark Visual System

## Goal

Replace the visually blended/glowy interface with a calmer, higher-contrast, Notion-like dark workspace.

The user feedback is that the current UI has too little contrast, too many elements competing, and colors swimming into each other.

## Required design direction

The style should be:

```text
Private
Calm
Dark
Readable
Notion-like
Personal workspace
Low visual noise
Clear next action
```

It should not be:

```text
SaaS dashboard
Developer admin panel
Glassy everywhere
Gradient-heavy
Overly glowing
Crowded
```

## CSS tokens

Update `apps/windows/src/styles.css` to use these tokens or very close equivalents:

```css
:root {
  color-scheme: dark;

  --bg-app: #05070b;
  --bg-sidebar: #080b10;
  --bg-main: #0b0e14;

  --surface-1: #11151d;
  --surface-2: #171c26;
  --surface-3: #202633;

  --border-soft: rgba(255, 255, 255, 0.08);
  --border-clear: rgba(255, 255, 255, 0.16);

  --text-main: #f4f6fa;
  --text-muted: #a4adba;
  --text-faint: #707989;

  --accent: #9ff5dc;
  --accent-strong: #68e8c3;

  --warning: #ffd166;
  --danger: #ff7a8a;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 22px;

  --shadow-soft: 0 18px 48px rgba(0, 0, 0, 0.28);
}
```

## Layout

Use a stable desktop layout:

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: var(--bg-app);
  color: var(--text-main);
}
```

Sidebar:

```css
.sidebar {
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-soft);
}
```

Workspace:

```css
.workspace {
  background: var(--bg-main);
}
```

Project surface:

```css
.project-surface,
.today-view,
.repo-view {
  max-width: 1080px;
  margin: 0 auto;
  padding: 42px 40px 140px;
}
```

## Contrast rules

- Sidebar must be visually distinct from main background.
- Main cards must be distinct from page background.
- Primary button must be visually obvious.
- Secondary buttons must not compete with primary button.
- Labels must be muted but readable.
- Body text must be comfortably readable.

## Primary button

Use the accent only for the main action.

```css
.primary {
  background: var(--accent);
  color: #04100d;
  border: 0;
  border-radius: var(--radius-md);
  font-weight: 750;
}
```

Do not use the accent for random decoration.

## Secondary buttons

```css
button:not(.primary) {
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  color: var(--text-main);
}
```

## Cards and sections

Reduce card heaviness.

Use:

```css
.section-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
}
```

Avoid large gradient cards.

## Sidebar project rows

Use compact Notion-like rows:

```css
.project-button {
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
}
.project-button.active {
  background: var(--surface-1);
  border-color: var(--border-clear);
  box-shadow: inset 3px 0 0 var(--accent);
}
```

## Motion

Use subtle motion only:

```css
button,
.project-button,
.section-card {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}
```

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

## Responsive

At narrow widths:

- Sidebar can stack above workspace or become narrower.
- Today/project/repo surfaces should use smaller padding.
- Grids should collapse to one column.
- Assistant bar must remain usable.

## Acceptance criteria

- Stronger contrast is visible immediately.
- The UI no longer feels like elements are blending together.
- Accent color appears mainly on primary CTA/focus/active marker.
- Large glow/gradient areas are removed or heavily reduced.
- The app feels closer to Notion dark mode than a neon dashboard.
