## 1. Window Infrastructure

- [x] 1.1 Add a dedicated detached file explorer window entrypoint and route keyed by a new window label.
- [x] 1.2 Add a window-opening service/command that opens or focuses the detached file explorer window by a fixed label and passes workspace session context to it.
- [x] 1.3 Define and implement the detached window session contract (`workspaceId`, `workspacePath`, `workspaceName`, optional `initialFilePath`, `updatedAt`) for create, focus, and retarget flows.
- [x] 1.4 Add detached session bootstrap and live retargeting plumbing so the detached window can restore or switch workspace context.

## 2. Shared File Explorer Composition

- [x] 2.1 Extract a shared file explorer workspace composition layer that combines file tree and file viewer without depending on `AppShell`.
- [x] 2.2 Split file-tree core rendering from main-window-only root actions so detached reuse does not inherit unrelated shell controls.
- [x] 2.3 Implement a detached-window-specific file explorer state hook for open tabs, active file, navigation, and close behavior.
- [x] 2.4 Reuse existing file tree and file viewer capabilities through the shared composition without duplicating feature logic.

## 3. Main Window Integration

- [x] 3.1 Add a detach/focus control to the embedded file panel workspace root row with clear copy that preserves the existing embedded panel.
- [x] 3.2 Wire the main window action so opening the detached explorer does not collapse, replace, or disable the embedded file panel.
- [x] 3.3 Keep embedded file panel behavior backward compatible while allowing the detached explorer to coexist for the same workspace.

## 4. Detached Window Behavior

- [x] 4.1 Render the detached window with a left file tree and right file content area scoped to the selected workspace.
- [x] 4.2 Support opening files, tab switching, and closing the detached explorer window without mutating the main window editor session.
- [x] 4.3 Update the detached window title and visible state when the user retargets it to a different workspace.
- [x] 4.4 Enable active polling only while the detached window is visible or focused, with fallback behavior that remains safe if the main window is polling the same workspace.

## 5. Validation

- [x] 5.1 Add tests for window route selection, detached session bootstrapping, and single-window reuse/focus behavior.
- [x] 5.2 Add tests for embedded-and-detached coexistence so the main window file panel remains available after detach.
- [x] 5.3 Add tests for detached file opening and workspace retargeting without overwriting the main window editor session.
- [x] 5.4 Add tests or instrumentation checks for detached polling visibility rules and double-polling regression signals.

## 6. Visual Semantics Parity (New)

- [x] 6.1 Add Git status decoration rendering to the detached file tree using the same status semantics and token mapping as the embedded file tree.
- [x] 6.2 Add diff-aware color rendering in detached file viewing (added/removed/modified/context) aligned with the embedded file viewer behavior.
- [x] 6.3 Add regression tests for detached Git decorations and detached diff coloring so visual semantics remain consistent across embedded and detached surfaces.
