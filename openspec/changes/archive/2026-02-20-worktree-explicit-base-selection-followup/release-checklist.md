# Worktree Explicit Base Selection Follow-up - Release Checklist

## 1) Scope Confirmation

- Change ID: `worktree-explicit-base-selection-followup`
- Capability: `git-worktree-base-selection` (follow-up hardening)
- Focus:
    - Worktree create error mapping readability
    - Publish result clarity (local success vs remote publish status)
    - Recoverable push-failure guidance (retry command)
    - `Gemini` entry explicit unavailable state

## 2) Verification Evidence

- [x] Error mapping regression (`1.1`)
    - Command:
        - `npx vitest run src/features/workspaces/hooks/useWorktreePrompt.test.tsx`
    - Coverage:
        - invalid base ref mapping
        - path conflict mapping
        - invalid branch / required branch mapping path (through parser branch)

- [x] Publish result + tracking visibility (`1.2`)
    - Command:
        - `npx vitest run src/features/workspaces/hooks/useWorktreePrompt.test.tsx`
    - Coverage:
        - success path asserts result notification includes tracking text

- [x] Local success + remote failure recoverable hint (`1.3`)
    - Commands:
        - `npx vitest run src/features/workspaces/hooks/useWorktreePrompt.test.tsx`
        - `npx vitest run src/features/workspaces/components/WorktreePrompt.test.tsx`
    - Coverage:
        - retry command extracted and stored
        - retry command rendered in modal

- [x] `Gemini` unavailable feedback (`2.1`)
    - Command:
        - `npx vitest run src/features/app/hooks/useSidebarMenus.test.tsx`
    - Coverage:
        - `Gemini` action marked `unavailable`
        - unavailable action click is blocked

- [x] Core regression suite (`3.1`)
    - Commands:
        - `npm run -s typecheck`
        -
        `npx vitest run src/features/workspaces/hooks/useWorktreePrompt.test.tsx src/features/workspaces/components/WorktreePrompt.test.tsx src/features/app/hooks/useSidebarMenus.test.tsx`
        -
        `npx vitest run src/features/app/hooks/useWorkspaceActions.test.tsx src/features/git-history/components/GitHistoryPanel.test.tsx`

- [x] OpenSpec strict validation (`3.2`)
    - Command:
        - `openspec validate worktree-explicit-base-selection-followup --strict`
    - Result:
        - `Change 'worktree-explicit-base-selection-followup' is valid`

## 3) Known Risks and Mitigations

- Risk: unseen backend error strings may still fall back to raw message
    - Mitigation: keep parser fallback visible; extend key mapping when new error signatures appear.

- Risk: users may interpret publish failure as full create failure
    - Mitigation: UI text explicitly states "local create success + remote publish failed".

- Risk: theme contrast regressions on unavailable/deprecated entries
    - Mitigation: keep manual light/dark visual QA item before release tag.

## 4) Rollback Plan

1. Revert front-end parser/message changes only:
    - `src/features/workspaces/hooks/useWorktreePrompt.ts`
    - `src/features/workspaces/components/WorktreePrompt.tsx`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
2. Keep backend workflow untouched (no protocol changes in this follow-up).
3. If needed, temporarily hide retry-command block in UI while preserving create path.

## 5) Release Gates for Auto Publish Path (`3.4`)

The release is blocked if any gate below is not met:

- Push success rate gate:
    - Metric: `% of publishToOrigin attempts that finish with tracking`
    - Target: `>= 95%` over last release window

- Auth failure rate gate:
    - Metric: `% of publish failures containing auth-related errors`
    - Target: `< 3%` and no sudden spike

- Retry-command availability gate:
    - Metric: `% of recoverable publish failures that expose retry command`
    - Target: `= 100%`

- Operator check:
    - Ensure failure dialogs include actionable retry command copy text before rollout.
