# App design

Use Mindb's compact desktop chrome and mobile navigation conventions. Keep
Heswe's Skeleton theme as the source of color tokens.

- Shared chrome and settings styles live in
  `packages/client/src/lib/ui-conventions.css`.
- Align desktop sidebar and tab headers at 44px. Use compact controls, thin
  borders, and subtle surface changes. Reserve shadows for overlays.
- Use one 720px breakpoint for mobile navigation and settings. Mobile controls
  need 44px touch targets; editable text needs at least 16px to avoid input zoom.
- On mobile, navigation overlays the workspace. Keep desktop pane sizes and
  open tabs intact when changing viewport size.
- Settings use a category sidebar on desktop and a category list with back
  navigation on mobile. Dialogs become sheets within the dynamic viewport and
  respect safe-area insets.
- Keep form descriptions brief, label icon controls, show keyboard focus, and
  return focus when navigating back.

Check both desktop and mobile layouts when changing shared UI. Include the
empty state, a long scrolling list, and an expanded form when relevant.
