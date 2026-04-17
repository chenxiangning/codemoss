## Why

当前 `Session Activity` 面板已经具备多 session 时间线与 turn group 折叠能力，但数据层仍采用“相关线程全集重放”的构建方式。随着 timeline 事件数进入 1000+，每次实时状态变化都全量重建 view model，会带来明显的卡顿、重复排序和无意义的历史重算。

## What Changes

- 将 `workspace session activity` 的实时刷新从“全量重建 timeline”调整为“按 thread 增量重建 + 合并刷新”。
- 为大 timeline 场景补齐可扫描性约束：继续保留 turn group 折叠，并确保最新 turn 默认展开、旧 turn 默认折叠。
- 修正 capability 契约与当前产品 reality 的偏差：`reasoning` 不再被 spec 视为必须排除，而是作为独立分类受控展示，不污染 `command / task / fileChange / explore` 统计。
- 保持右侧 activity panel 与旧 `StatusPanel`、消息区 tool cards、runtime console 的职责边界不变。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`: 调整 activity panel 的实时刷新、超大时间线扫描、turn group 折叠与 reasoning 分类契约。

## Impact

- 受影响代码：
  - `src/features/session-activity/adapters/buildWorkspaceSessionActivity.ts`
  - `src/features/session-activity/hooks/useWorkspaceSessionActivity.ts`
  - `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`
  - `src/features/session-activity/**/*.test.ts*`
- 无新增外部依赖，无 API 破坏性变更。
- 影响范围限定在右侧 activity panel 的数据构建和展示性能，不改动旧消息区与 status panel 的职责。
