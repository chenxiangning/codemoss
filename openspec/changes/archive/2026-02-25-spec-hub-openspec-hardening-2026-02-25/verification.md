# Verification: spec-hub-openspec-hardening-2026-02-25

## Scope

本次验证覆盖：

- Verify 证据从会话 timeline 解耦（持久化/可复算）
- `truncated` 风险接入 gate/doctor 可见性
- change 排序稳定化（不依赖 `changeId` 日期前缀）
- Spec Hub hook/UI/bridge/session-linking 关键回归测试

## Test Environment

- Date: 2026-02-25
- Main repo: `codex-fix-one-v0.1.9`
- Spec repo: `codemoss-openspec`
- Change: `spec-hub-openspec-hardening-2026-02-25`

## Preconditions

- [x] 当前分支包含本 change 的实现改动
- [x] `openspec/changes/spec-hub-openspec-hardening-2026-02-25/{proposal,design,specs,tasks}.md` 已存在
- [x] Node/NPM 与项目依赖可用

## Automated Checks

### 1) Spec Runtime / Thread / Bridge Focused Tests

Command:

```bash
npx vitest run \
  src/features/spec/runtime.test.ts \
  src/features/threads/hooks/useThreadMessaging.test.tsx \
  src/services/tauri.test.ts
```

Result:

- Status: `[x] Passed`
- Notes: `3 files, 103 tests passed`

### 2) Spec Hook / Component Focused Tests

Command:

```bash
npx vitest run \
  src/features/spec/hooks/useSpecHub.test.tsx \
  src/features/spec/components/SpecHub.test.tsx
```

Result:

- Status: `[x] Passed`
- Notes: `2 files, 7 tests passed`；`SpecHub.test.tsx` 仍有 React `act(...)` warning（不影响退出码）

### 3) Type Check

Command:

```bash
npm run typecheck
```

Result:

- Status: `[x] Passed`
- Exit code: `0`
- Notes: `tsc --noEmit` 全绿

### 4) Lint (Targeted)

Command:

```bash
npx eslint \
  src/features/spec/runtime.ts \
  src/features/spec/hooks/useSpecHub.ts \
  src/features/spec/components/SpecHub.tsx \
  src/features/threads/hooks/useThreadMessaging.ts \
  src/services/tauri.ts
```

Result:

- Status: `[x] Passed`
- Notes: 0 error / 2 warnings（`useThreadMessaging.ts` 的 `react-hooks/exhaustive-deps` 既有告警）

## Acceptance Criteria Matrix

### AC-1 Verify 状态跨刷新/切换可保持

- [x] 验证步骤完成
- 操作步骤：
    1. 执行 verify 后持久化 change 级 evidence
    2. 无 timeline validate 事件时读取持久 evidence
- 期望结果：
    - archive gate 仍识别“已通过验证”
- 证据（日志/截图/测试）：
    - `useSpecHub.test.tsx`: `uses persisted verify evidence when timeline has no verify event`
    - `useSpecHub.test.tsx`: `persists verify result when verify action succeeds`

### AC-2 `tasks/specs` 截断时 gate 至少降级为 warn

- [x] 验证步骤完成
- 操作步骤：
    1. 构造 `truncated=true` 的 tasks/specs 读取场景
    2. 打开 gate 面板检查提示映射
- 期望结果：
    - gate 至少为 `warn`
    - 显示明确风险提示
- 证据（日志/截图/测试）：
    - `runtime.test.ts`: `marks artifact gate as warn when tasks or specs are truncated`
    - `SpecHub.test.tsx`: `maps truncated artifact gate message with interpolation`

### AC-3 排序不依赖 changeId 前 10 位

- [x] 验证步骤完成
- 操作步骤：
    1. 模拟非日期前缀 changeId
    2. 比较排序结果
- 期望结果：
    - 顺序稳定且可解释
- 证据（日志/截图/测试）：
    - `runtime.test.ts`: `sorts changes by date hints found anywhere in change id`

### AC-4 `useSpecHub` 关键联动覆盖

- [x] 验证步骤完成
- 覆盖点：verify evidence 读取/写入与 gate/action 联动
- 证据（测试名/断言）：
    - `useSpecHub.test.tsx`: `uses persisted verify evidence when timeline has no verify event`
    - `useSpecHub.test.tsx`: `persists verify result when verify action succeeds`

### AC-5 `SpecHub` 关键交互覆盖

- [x] 验证步骤完成
- 覆盖点：actions 可用性、doctor 展示、gate 映射、timeline 关键事件
- 证据（测试名/断言）：
    - `SpecHub.test.tsx`: `maps no verify evidence gate message to i18n key`
    - `SpecHub.test.tsx`: `maps truncated artifact gate message with interpolation`
    - `SpecHub.test.tsx`: `renders actions with availability and blockers`
    - `SpecHub.test.tsx`: `renders doctor checks and hints`
    - `SpecHub.test.tsx`: `renders timeline entries with command and output`

### AC-6 Tauri external spec wrappers 映射覆盖

- [x] 验证步骤完成
- 覆盖点：`listExternalSpecTree` / `readExternalSpecFile` / `writeExternalSpecFile`
- 证据（测试名/断言）：
    - `tauri.test.ts`: `maps list external spec tree payload`
    - `tauri.test.ts`: `maps read external spec file payload`
    - `tauri.test.ts`: `maps write external spec file payload`

### AC-7 `/spec-root` 正向 visible 分支正确

- [x] 验证步骤完成
- 操作步骤：
    1. 触发 spec root probe 产生 `visible`
    2. 检查 context card 是否无修复噪声
- 期望结果：
    - 状态为 `visible`
    - 不显示误导性修复动作（rebind/default）
- 证据（日志/截图/测试）：
    - `useThreadMessaging.test.tsx`: `records visible probe status without repair actions in spec context card`
    - `useThreadMessaging.test.tsx`: `updates spec root context to visible after /spec-root rebind succeeds`

## OpenSpec Strict Validation

Command:

```bash
openspec validate spec-hub-openspec-hardening-2026-02-25 --strict
```

Result:

- Status: `[x] Passed`
- Output: `Change 'spec-hub-openspec-hardening-2026-02-25' is valid`

## Regression Notes

- 新增风险：未新增阻断级风险
- 已知限制：`SpecHub.test.tsx` 仍有 React `act(...)` warning（当前不影响退出码）
- 后续建议：按需清理 `SpecHub.test.tsx` 的 `act(...)` warning

## Manual Regression (Task 6.3)

### A) verify -> archive gate

- Command:

```bash
npx vitest run src/features/spec/runtime.test.ts -t "allows archive when strict verify passed and required tasks are complete"
```

- Result:
    - Status: `[x] Passed`
    - Notes: `1 passed | 33 skipped`

### B) /spec-root rebind -> visible

- Command:

```bash
npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx -t "updates spec root context to visible after /spec-root rebind succeeds"
```

- Result:
    - Status: `[x] Passed`
    - Notes: `1 passed | 26 skipped`

### Acceptance Linkage

- [x] AC-1: verify 证据驱动 archive gate（由 A 覆盖）
- [x] AC-7: `/spec-root` rebind 成功后 visible 收敛（由 B 覆盖）

## Conclusion

- Overall: `[x] Ready for apply` / `[ ] Needs fixes`
- Verified by: Codex (GPT-5)
- Verified at: 2026-02-25 15:24:43 CST
