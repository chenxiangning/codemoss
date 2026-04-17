# Verification

## Scope

- Verified this change against `proposal.md`, `design.md`, `tasks.md`, and modified specs under:
    - `specs/spec-hub-workbench-ui/spec.md`
    - `specs/spec-hub-runtime-state/spec.md`
    - `specs/spec-hub-adapter-openspec/spec.md`
- Evidence collection focused on implemented items in task groups 6-17, including:
    - 16.x Continue AI enhancement + Apply handoff core flow
    - 17.x proposal-only progressive completion gate matrix
- Manual-regression-only tasks remain pending (14.4 / 15.7 / 16.12 / 17.7).

## Checks Run

1. Artifact review
    - `cat changes/spec-hub-apply-auto-execution-feedback-2026-02-25/{proposal.md,design.md,tasks.md}`
    - `cat changes/spec-hub-apply-auto-execution-feedback-2026-02-25/specs/*/spec.md`
2. Implementation evidence scan (workspace `codex-fix-one-v0.1.9`)
    -
    `rg -n "verifyAutoComplete|completion-dispatch|validateSkipped|new proposal|append proposal|image|drag" src/features/spec src/styles src/i18n`
    -
    `rg -n "continueAi|AI enhancement|useContinueBrief|continue brief" src/features/spec/components/SpecHub.tsx src/features/spec/hooks/useSpecHub.ts src/features/spec/runtime.ts src/i18n/locales/en.ts src/i18n/locales/zh.ts`
   -
   `rg -n "proposal-only|Run continue first to generate specs delta|next step" src/features/spec/runtime.test.ts src/lib/spec-core/runtime.ts src/features/spec/components/SpecHub.tsx`
3. Test evidence
    -
    `pnpm vitest run src/features/spec/components/SpecHub.test.tsx src/features/spec/hooks/useSpecHub.test.tsx src/features/spec/runtime.test.ts`

## Results

- Test run passed: **3/3 test files**, **84/84 tests**.
- Verify auto-completion and overlay reuse evidence found in UI/runtime/tests/i18n:
    - `src/features/spec/components/SpecHub.tsx` (verify toggle state, completion->verify phases, `validateSkipped`,
      shared floating feedback)
    - `src/features/spec/components/SpecHub.test.tsx` (verify auto-completion behavior, skipped validate semantics,
      draggable feedback test)
    - `src/i18n/locales/en.ts`, `src/i18n/locales/zh.ts` (verify auto-completion messaging)
- Proposal modal/image/engine-row evidence found in:
    - `src/features/spec/components/SpecHub.tsx` (create/append proposal, image attachment validation, icon-only
      proposal triggers)
    - `src/features/spec/components/SpecHub.test.tsx` (engine + icon-only row, image attach flow, validation errors)
    - `src/styles/spec-hub.css` (proposal dialog/composer/floating feedback styles)
- Continue AI enhancement + handoff evidence found in:
    - `src/features/spec/components/SpecHub.tsx` (continue `AI Enhancement` toggle, read-only dispatch,
      continue brief scope state, stale hint, auto-apply handoff)
    - `src/features/spec/hooks/useSpecHub.ts` (`buildApplyExecutionPrompt` 注入 continue brief，上下文日志)
    - `src/features/spec/components/SpecHub.test.tsx`, `src/features/spec/hooks/useSpecHub.test.tsx`
      （continue/read-only/brief 注入相关断言）
- Proposal-only progressive completion evidence found in:
    - `src/lib/spec-core/runtime.ts` (`buildSpecActions` 对 continue/apply blocker 的新矩阵规则)
    - `src/features/spec/runtime.test.ts`（proposal-only 场景 continue 可用、apply continue-first blocker 断言）
    - `src/features/spec/components/SpecHub.tsx`（动作区 next-step 提示渲染）

## Risks/Follow-ups

- TODO: Execute pending manual regression tasks in `tasks.md`:
    - 14.4 (verify toggle manual flow)
    - 15.7 (draggable overlay on narrow/scroll scenarios)
  - 16.12 (continue enhancement + brief handoff manual flow)
  - 17.7 (proposal-only 渐进补全手工回归)
- TODO: 补充自动化测试缺口：
    - 16.11 (`runtime.test.ts` 增补 read-only 语义与 brief 解析失败降级断言)
    - 17.6 (`SpecHub.test.tsx` 增补 proposal-only continue 可点与缺 specs 提示/按钮态断言)
- Test run includes repeated React `act(...)` warnings in `SpecHub.test.tsx`; not failing, but should be cleaned to
  reduce noise and improve test confidence.
