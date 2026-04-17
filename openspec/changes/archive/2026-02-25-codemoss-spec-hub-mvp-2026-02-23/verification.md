# Verification: codemoss-spec-hub-mvp-2026-02-23

## Scope

本次验收覆盖：

- Spec Hub 三栏布局与执行台四 Tab（动作/门禁/时间线/环境诊断）
- Runtime/Adapter/Doctor 主链路
- spec-kit minimal hook（detect/read-only/passthrough）
- 任务进度可视化与 blocker 一致性
- OpenSpec 初始化引导（无 OpenSpec 场景 + 新/老项目分支）
- 外置 Spec 根目录配置（default/custom 切换 + 异常路径降级）

## Test Environment

- Date: 2026-02-24
- Main repo: `codex-fix-one-v0.1.9`
- Spec repo: `codemoss-openspec`

## Automated Checks

### 1) Full Test Suite

Command:

```bash
npm run test
```

Result:

- Passed, `94` test files completed.

### 2) Type Check

Command:

```bash
npm run typecheck
```

Result:

- Passed, exit code `0`.

### 3) Lint

Command:

```bash
npm run lint
```

Result:

- Passed with warnings only (`0` errors, `8` warnings).
- Warnings are existing `react-hooks/exhaustive-deps` items in non-SpecHub modules.

### 4) Spec Runtime Focused Test

Command:

```bash
npx vitest run src/features/spec/runtime.test.ts
```

Result:

- Passed, `26` tests.
- Includes newly added assertions:
    - change-level blockers merge into action blockers
    - tasks artifact progress metadata parsing
    - artifact gate fail when selected change has blockers
    - tasks checklist parsing with priority metadata (`P0/P1/P2`)
    - checkbox toggle write-back for workspace/custom spec root
    - archive gate requires both strict verify pass and required tasks completion

### 5) Onboarding + External Spec Root Focused Checks (for 7.8 / 8.8)

Command:

```bash
npx vitest run src/features/spec/runtime.test.ts src/services/tauri.test.ts
npm run typecheck
npx eslint src/features/spec/runtime.test.ts
```

Result:

- Passed, `62` tests (`26` in `runtime.test.ts`, `36` in `tauri.test.ts`).
- `runtime.test.ts` 新增覆盖：
    - unknown workspace 下生成 onboarding-ready 状态
    - custom spec root 不可用时返回结构化 blocker + hint
    - custom spec root 命令执行包装（临时 `openspec` 软链）
    - custom spec root 为 `.../openspec` 时父目录执行路径
    - speckit provider 忽略 custom spec root
- `typecheck` passed, exit code `0`.
- `eslint`（`runtime.test.ts`）passed, `0` errors.

### 6) Task Toggle + Archive Gate Focused Checks (for 9.8)

Command:

```bash
npx vitest run src/features/spec/runtime.test.ts
npm run typecheck
npx eslint src/features/spec/runtime.ts src/features/spec/hooks/useSpecHub.ts src/features/spec/components/SpecHub.tsx src/features/spec/runtime.test.ts
```

Result:

- Passed, `26` tests in `runtime.test.ts`.
- `typecheck` passed, exit code `0`.
- `eslint`（Spec Hub 相关 TS/TSX 文件）passed, `0` errors.

### 7) Task Rendering + Interaction Rule Clarity Checks (for 9.9)

Command:

```bash
npm run typecheck
npx eslint src/features/spec/components/SpecHub.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
```

Result:

- `typecheck` passed, exit code `0`.
- `eslint` passed, `0` errors（仅针对 TS/TSX/i18n 文件；CSS 不在当前 eslint 管线内）。
- UI 行为确认：
    - 任务区顶部展示可点击规则与只读原因
    - 执行动作中任务统一只读，不再出现“部分可点部分不可点”的隐式状态
    - 任务内容按“标题/任务行/续行说明”分层渲染，可读性优于 markdown checkbox 劫持

## Manual QA Checklist

- [x] 左栏支持 `全部/活跃/阻塞/归档` 过滤并可切换变更上下文
- [x] 中栏支持 Proposal/Design/Specs/Tasks/Verification tabs 与空态展示
- [x] 右栏执行台包含 `动作/门禁/时间线/环境诊断` 四个 Tab
- [x] `Apply` 在缺失 `tasks.md` 等 blocker 时禁用并显示原因
- [x] `Verify` 失败可展示结构化诊断并支持跳转到对应产物
- [x] Doctor 模式切换（Managed/BYO）可持久化，刷新后保持
- [x] spec-kit workspace 呈现 minimal 模式并提供 passthrough 入口
- [x] Tasks 页显示任务进度（`checked/total`）

## Add-on Manual QA (for 7.8 / 8.8)

### A. OpenSpec 初始化引导与项目信息（7.8）

- [x] 无 OpenSpec 目录时，右侧执行台可见“项目”Tab 和初始化引导文案
- [x] 项目类型支持“老项目/新项目”分支并映射到初始化命令
- [x] 执行后自动写入 `openspec/project.md`，并在时间线记录执行与写入结果
- [x] 初始化成功后自动刷新 snapshot，provider 从 `unknown` 转为 `openspec`

### B. 外置 Spec 根目录配置（8.8）

- [x] 支持配置自定义绝对路径并持久化到 workspace 级存储
- [x] 切换 custom path 后无需重开页面，changes/artifacts 即时刷新
- [x] 非绝对路径输入被拦截并提示错误
- [x] custom root 不存在/不可读时，显示结构化 blocker 与修复提示
- [x] 恢复默认路径后，回到 workspace 内 `openspec` 视图

### C. Tasks 可点击性与渲染一致性（9.9）

- [x] 任务区明确提示“仅任务行可编辑”，用户可预期可点击范围
- [x] 动作执行中/写回中任务进入只读态并显示原因提示
- [x] 复杂层级 tasks 文档渲染稳定，不再依赖 markdown input 顺序映射

## OpenSpec Strict Validation

Command:

```bash
openspec validate codemoss-spec-hub-mvp-2026-02-23 --strict
```

Result:

- Passed: `Change 'codemoss-spec-hub-mvp-2026-02-23' is valid`.

## Artifacts Produced

- Proposal/Design/Specs/Tasks completed
- `apply-plan-p0.md` / `apply-plan-p1.md`
- `task-confirmation-matrix.md`
- `demo-script.md`

## Conclusion

该变更已完成 7.x/8.x/9.x/10.x/12.x 的自动化与手工验收，当前任务定义已对齐并具备归档前置条件。

### 8) AI Takeover Execution Visibility Checks (for 12.6)

Command:

```bash
npm run -s typecheck
npx eslint src/features/spec/components/SpecHub.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
npx vitest run src/features/spec/runtime.test.ts
```

Result:

- `typecheck` passed, exit code `0`.
- `eslint` passed, `0` errors（TS/TSX/i18n 范围；CSS 不在当前 eslint 管线内）。
- `runtime.test.ts` passed, `30` tests.
- UI 行为确认：
    - 点击 AI 接管后立即进入 running 态，并禁用重复触发
    - 面板展示分阶段状态（发起 / 智能体执行 / 刷新状态）
    - 失败时显示结构化错误并保留执行日志
    - 完成后显式回显刷新结果（自动刷新成功/失败）

### 9) Session-Level Spec Linking Checks (for 10.1 ~ 10.7)

Command:

```bash
npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx src/features/spec/runtime.test.ts
```

Result:

- Passed, `51` tests（`21` in `useThreadMessaging.test.tsx`, `30` in `runtime.test.ts`）。
- 10.1 evidence:
    - 会话消息发送前读取 workspace 级 `specHub.specRoot.<workspaceId>` 并形成会话上下文输入。
    - 首轮消息会注入“External Spec Root (Priority)”上下文卡片，回显当前生效路径。
- 10.2 evidence:
    - `customSpecRoot` 已透传至 Codex/OpenCode 消息发送参数。
    - Codex runtime 以 `writableRoots=[customSpecRoot, workspacePath]` 注入白名单，避免仅依赖项目名推导。
- 10.3 evidence:
    - 新增会话级探测状态模型：`visible | invalid | permissionDenied | malformed`。
    - 首次会话消息发送时（外置 spec root 场景）执行探测并结构化落到会话上下文卡片。
- 10.4 evidence:
    - 首屏上下文卡片展示已关联路径、探测状态与失败原因（若存在）。
- 10.5 evidence:
    - 新增会话内修复动作：`/spec-root rebind` 与 `/spec-root default`，执行后立即重探测并回显结果。
- 10.6 evidence:
    - Codex 注入文案增加会话探测状态与“invalid link 禁止 silent fallback”约束，回答链路绑定真实探测状态。
- 10.7 evidence:
    - 自动化：`useThreadMessaging.test.tsx` 新增 malformed + 修复命令场景；`useQueuedSend.test.tsx` 新增 `/spec-root`
      路由场景。
    - 验证命令：
        -
        `npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx src/features/threads/hooks/useQueuedSend.test.tsx`
        - `npm run -s typecheck`
        -
        `npx eslint src/features/threads/hooks/useThreadMessaging.ts src/features/threads/hooks/useThreadMessaging.test.tsx src/features/threads/hooks/useQueuedSend.ts src/features/threads/hooks/useQueuedSend.test.tsx src/features/app/hooks/useComposerController.ts src/features/threads/hooks/useThreads.ts src/App.tsx`
    - 结果：测试通过；typecheck 通过；eslint 0 error（存在既有 warning）。
