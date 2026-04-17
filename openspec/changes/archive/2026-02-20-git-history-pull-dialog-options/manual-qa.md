# Manual QA - git-history-pull-dialog-options

Date: 2026-02-21
Scope: Git History toolbar actions `Pull / Sync / Fetch / Refresh`

## Checklist

- [x] Pull click opens confirmation dialog before execution.
- [x] Pull dialog contains Intent / Will Happen / Will NOT Happen / Example sections.
- [x] Pull dialog supports remote/branch/options with chips and confirm execution path.
- [x] Sync click opens confirmation dialog before execution.
- [x] Sync dialog shows preflight summary: target, ahead/behind, outgoing commit sample.
- [x] Fetch click opens confirmation dialog before execution.
- [x] Fetch dialog clearly presents `git fetch --all` scope example.
- [x] Refresh click opens confirmation dialog before execution.
- [x] Refresh dialog states UI-only refresh without Git network command.
- [x] Toolbar icon semantics are distinct for Fetch and Refresh.

## Notes

- Verified through local interaction flow and matching automated checks in `GitHistoryPanel.test.tsx`.
