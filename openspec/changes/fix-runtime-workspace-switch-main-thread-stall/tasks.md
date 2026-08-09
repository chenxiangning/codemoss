# Tasks: fix-runtime-workspace-switch-main-thread-stall

## S0 — Spec & plan

- [x] proposal.md / design.md / tasks.md
- [x] specs/runtime-workspace-switch-hydration/spec.md

## S1 — listThreads early-stale

- [x] `useThreadActions.ts`: `abandonIfStale` + checkpoints before/after major IPC stages
- [x] Do not construct multi-engine fan-out promises when already stale
- [x] gemini / kimi / grok background refresh honor `isLatestThreadListRequest` (incl. isStale)

## S2 — Tests

- [x] Mid-flight isStale: no further list IPC + no setThreads (`useThreadActions.stale-list-abandon.test.tsx`)
- [x] Existing hydration cancel + orchestrator suites still pass

> Known unrelated test-harness issue: `useThreadActions.timeout-fallback` case 1 can hang 20s under fake-timer/rAF even without this change；它不属于本 change 的完成项。

## S3 — Verify (no commit)

- [x] focused vitest green (stale-abandon + hydration + orchestrator + shared-history)
- [x] leave working tree uncommitted for user hand test

## S4 — Root-cause correction after failed manual acceptance

- [x] Record that the 2026-08-08 early-stale build did not materially improve the original switch freeze
- [x] Trace independent AppShell `projection summary -> limit=9999 -> all-engine catalog` chain
- [x] Replace navigation projection IPC with local main/direct-worktree topology derivation
- [x] Preserve worktree isolation and workspace-registry-pending fallback
- [x] Add pure topology tests and AppShell no-projection regression
- [x] Remove unsafe `return` from hydration `finally` without changing idle full-catalog guards

## S5 — Closeout evidence (no commit)

- [x] Write version/author/root-cause performance analysis and link prior incident docs
- [x] Run focused Vitest, TypeScript, target lint, docs, runtime contract, large-file, doctor, and OpenSpec strict validation
- [ ] User manual test: repeatedly switch projects and open Shared/native sessions; confirm no 5–10s whole-window freeze

> Automated result：focused Vitest、target ESLint、typecheck、runtime contracts、large-file 与 OpenSpec strict 通过。Repository-wide `pnpm test`、`pnpm lint`、`check:docs`、`doctor:strict` 命中未改文件中的既有 baseline 问题；已在交付说明列出，不冒充本 change 回归。
