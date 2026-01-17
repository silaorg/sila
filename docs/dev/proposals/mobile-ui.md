# Proposal: Mobile UI Adaptation

## Goal
List the main UI components that must be adapted for mobile.

## Context
The current UI is built for desktop layouts and pointer input. Mobile needs touch targets, single-column flows, and safe-area handling.

## Components to adapt
1) **TTabs layout** (`SpaceTTabsLayout.svelte`, `packages/client/src/lib/ttabs/*`)
   - Replace top tabs and split panes with a mobile tab switcher.
   - The plan is to implement this in the TTabs repo.

2) **Sidebar navigation** (`Sidebar.svelte`, `HoverSidebar.svelte`, `AppButtons.svelte`, `AppTrees.svelte`)
   - Convert the column sidebar to a drawer or bottom navigation.
   - Ensure it works with one-handed use.

3) **Swins stack windows** (`SwinsContainer.svelte`, `packages/client/src/lib/swins/routes/*`)
   - Convert stacked popovers to full-screen sheets or pages.
   - Keep back navigation clear and consistent.

4) **Chat app UI** (`ChatApp.svelte`, `ChatEditor.svelte`, `SendMessageForm.svelte`)
   - Reflow message list and editor for small screens.
   - Handle soft keyboard and attachment preview layout.

5) **Files app** (`FilesApp.svelte`, `FolderView.svelte`, `DragOverlay.svelte`)
   - Replace drag-and-drop with touch actions.
   - Use a list or grid layout with large targets.

6) **File viewers** (`VertexViewerModal.svelte`, `FilePreview.svelte`, `PdfFileView.svelte`)
   - Make previews full-screen with swipe navigation.
   - Optimize zoom and scroll on mobile.

7) **Popups and context menus** (`ContextMenu.svelte`, `FloatingPopover.svelte`, popups/*)
   - Replace right-click menus with action sheets.
   - Ensure all actions are reachable via touch.

8) **Settings and wizards** (`SpaceSetupWizard.svelte`, `FreshStartWizard.svelte`, `swins/routes/Settings*.svelte`)
   - Use a single-column layout and clear step flows.
   - Avoid multi-panel settings layouts.

9) **Global shortcuts and key handlers** (`GlobalKeyHandlers.svelte`)
   - Disable desktop-only shortcuts on mobile.
   - Provide visible UI actions instead.

10) **Dev-only tools** (`DevPanel.svelte`, `SpaceInspectorWindow.svelte`)
   - Hide or gate these behind a mobile-friendly toggle.

## Acceptance checks
- Every core screen works in a single-column layout.
- Touch targets meet minimum size guidance.
- No UI requires hover or right-click.
- Navigation works with a thumb and safe areas.
