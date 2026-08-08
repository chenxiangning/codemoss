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
- [ ] note: `useThreadActions.timeout-fallback` case 1 hangs 20s **without** this change too (pre-existing fake-timer/rAF issue); not a regression of this change

## S3 — Verify (no commit)

- [x] focused vitest green (stale-abandon + hydration + orchestrator + shared-history)
- [x] leave working tree uncommitted for user hand test
