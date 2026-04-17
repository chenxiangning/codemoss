# Code Alignment Report (2026-03-20)

## Scope

- Spec Root: `/Users/chenxiangning/code/AI/github/codemoss-openspec`
- Code Root (evidence source): `codex-2026-03-20-v0.3.1`
- Window: `2026-03-18` ~ `2026-03-20`
- Goal: strengthen OpenSpec project documentation granularity with code-backed evidence.

## Snapshot Metrics

| Metric | Value |
|---|---:|
| Main specs (`openspec/specs/*`) | 92 |
| Archived changes (`openspec/changes/archive/*`) | 80 |
| Active changes (`openspec/changes/*` excluding archive) | 0 |
| `spec.md` files with Purpose filled | 31 |
| `spec.md` files with Purpose still `TBD` | 61 |
| Legacy namespace capabilities (`spec-platform-*`) | 5 |

## Capability Domain Counts

| Domain | Count |
|---|---:|
| `spec-hub-*` | 13 |
| `spec-platform-*` (legacy) | 5 |
| `codex-chat-canvas-*` | 9 |
| `workspace-*` | 8 |
| `composer-*` | 9 |
| `file-view/file-tree/filetree-*` | 5 |
| `git-*` | 8 |
| `opencode-*` | 6 |
| `conversation-*` | 4 |
| `project-memory-*` | 5 |
| `session-activity-*` | 1 |
| `memory-list-*` | 4 |
| `kanban-*` | 2 |
| `panel-lock-*` | 2 |
| integration/connector (`feishu-*`,`third-party-*`,`external-message-*`) | 3 |
| large-file governance (`large-file-*`,`bridge-cleanup-*`) | 2 |
| runtime-log (`project-runtime-log-viewer`) | 1 |
| misc | 5 |

`misc` capability list:
- `claude-chat-canvas-review-quick-action`
- `codex-collaboration-mode-runtime-enforcement`
- `codex-compaction-runtime-events`
- `codex-context-auto-compaction`
- `codex-native-plan-default-parity`

## Recent Code-to-Spec Evidence Matrix

| Capability | Commit(s) | Key Evidence (Code Anchors) | Sync Result |
|---|---|---|---|
| `file-view-language-rendering-coverage` | `f4d3f97` | `src/utils/fileLanguageRegistry.ts:29,43-55,64-104`; `src/features/files/components/FileStructuredPreview.tsx:10,38-41,59-60`; `src/utils/syntax.test.ts:13,18` | Main spec updated |
| `session-activity-external-file-open` | `41b9f7d` | `src/utils/workspacePaths.ts:170,187,249`; `src/features/files/components/FileViewPanel.tsx:589,707,721,868`; `src-tauri/src/workspaces/files.rs:758,829,899,959` | Main spec updated |
| `workspace-session-radar-overview` | `6424db3`,`86ec38e`,`eebfbe6` | `src/features/session-activity/hooks/useSessionRadarFeed.ts:9-10,237,292,298,302`; `src/app-shell.tsx:2347,2959-2962` | Main spec updated |
| `composer-incremental-undo-redo` | `a0c3736` | `src/features/composer/components/ChatInputBox/hooks/useUndoRedoHistory.ts:52,141`; `src/features/composer/components/ChatInputBox/utils/undoRedoShortcut.ts` | Main spec updated |
| `spec-hub-external-spec-location` | `2a2b32b` | `src-tauri/src/workspaces/commands.rs:76,119,127`; `src-tauri/src/workspaces/files.rs:758`; `src/lib/spec-core/runtime.ts:833-845` | Main spec updated |

## Archive Activity Pulse

Recent archive frequency:

| Date | Archived Change Count |
|---|---:|
| 2026-03-11 | 4 |
| 2026-03-12 | 2 |
| 2026-03-13 | 1 |
| 2026-03-14 | 2 |
| 2026-03-15 | 2 |
| 2026-03-16 | 1 |
| 2026-03-18 | 5 |
| 2026-03-19 | 5 |

Latest archived changes on `2026-03-19`:
- `2026-03-19-2026-03-19-codex-user-input-license-display-format`
- `2026-03-19-2026-03-20-file-open-shell-group-rendering`
- `2026-03-19-fix-chat-input-incremental-undo`
- `2026-03-19-session-activity-external-file-open`
- `2026-03-19-workspace-session-radar-panel`

## Gap Register

1. Purpose completion debt remains high (`61/92` still `TBD`).
2. Legacy namespace (`spec-platform-*`) still has 5 capabilities requiring gradual canonical migration.
3. No active change currently; future code-side feature work should reopen change lifecycle to keep traceability.

## Suggested Next Sync Iteration

1. Batch-fill Purpose for top 20 high-traffic capabilities (git/spec-hub/workspace/composer).
2. Introduce a lightweight CI check: reject new archive if target main spec keeps `Purpose: TBD`.
3. Add monthly namespace migration review for remaining `spec-platform-*` items.
