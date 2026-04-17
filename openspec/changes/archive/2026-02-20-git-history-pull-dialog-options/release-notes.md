# Release Notes - git-history-pull-dialog-options

## Summary

Git History toolbar actions `Pull / Sync / Fetch / Refresh` are now confirmation-first.
All four actions require explicit user confirmation before execution.

## User-visible Changes

- Pull now opens a parameterized dialog before execution.
- Pull dialog supports remote, target branch, strategy and additive options with chips.
- Sync now opens a confirmation dialog with preflight summary.
- Fetch now opens a confirmation dialog and explicitly indicates default scope `all remotes`.
- Refresh now opens a confirmation dialog and clearly states no Git network command is executed.
- Fetch and Refresh toolbar icons are now visually distinct.

## Compatibility

- Default pull behavior is preserved when no extra pull options are selected.
- Existing push dialog flow is unchanged.

## Verification

- TypeScript typecheck passed.
- Targeted Vitest suites passed (`GitHistoryPanel.test.tsx`, `tauri.test.ts`).
- Rust `cargo check` passed.
