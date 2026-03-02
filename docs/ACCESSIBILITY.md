# Accessibility (A11y) Audit

This document summarizes how the app aligns with **WCAG 2.1 Level AA** and modern accessibility practices.

## Implemented

- **Skip link** (2.4.1 Bypass Blocks): "Skip to main content" at top; visible on focus.
- **Focus visible** (2.4.7): Visible focus styles on calendar search, meal planner input, delete household button.
- **Live regions**: Error messages use `role="alert"`; success use `role="status"` and `aria-live="polite"`.
- **Keyboard** (2.1.1): Todo item label activates on Enter and Space; grocery tabs support Arrow Left/Right, Home, End.
- **Modal focus trap**: Calendar "Add event" and event popover dialogs trap focus, close on Escape, and restore focus on close; `aria-modal="true"`.
- **Grocery tabs**: Full tab pattern with `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`/`id`/`aria-labelledby`, and arrow-key navigation.
- **Page titles** (2.4.2): Per-route document titles (e.g. "Dashboard - Lionfish", "Settings - Lionfish"); cleanup restores "Lionfish".

## Remaining considerations

- **Reduced motion**: No `prefers-reduced-motion` handling yet.
- **Color contrast**: Run contrast checks on text and UI to ensure at least 4.5:1 (normal text) and 3:1 (large/UI).

## Testing

- Use **keyboard only** (Tab, Enter, Space, Escape, Arrow keys) to navigate and operate all features.
- Test with a **screen reader** (e.g. NVDA, VoiceOver).
- Run **axe DevTools** or **Lighthouse** accessibility audit on key pages.
