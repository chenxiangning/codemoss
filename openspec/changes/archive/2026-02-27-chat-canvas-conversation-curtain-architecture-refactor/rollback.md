# Chat Canvas Curtain Rollback Playbook

## 目标

在出现一致性回归时，按 feature flag 维度快速回退，不影响消息主链路可用性。

## Flags

- `chatCanvasUseNormalizedRealtime`
- `chatCanvasUseUnifiedHistoryLoader`
- `chatCanvasUsePresentationProfile`

## 单 Flag 回退步骤

1. 将目标 flag 置为 `false`。
2. 重启前端会话（确保新设置生效）。
3. 执行最小冒烟：
   - 消息流（delta + completed）
   - Tool 卡状态（started/completed/failed）
   - Plan 快览与右侧面板
   - RequestUserInput 提交往返
   - 历史恢复
4. 若仍异常，逐步关闭其余新链路 flag，定位到最小问题面。

## 本次变更默认值

- 三个 flag 默认均为 `false`，默认路径仍为稳定旧链路。

## 回滚验证命令

```bash
pnpm vitest run \
  src/features/app/hooks/useAppServerEvents.test.tsx \
  src/features/threads/hooks/useThreadActions.test.tsx \
  src/features/threads/loaders/historyLoaders.test.ts \
  src/features/threads/adapters/realtimeAdapters.test.ts
pnpm tsc --noEmit
```

## 回退演练记录（9.3）

- 日期：2026-02-27
- 演练方式：单 flag 维度逐项验证（其余 flag 保持默认）
- 演练证据：
  - `chatCanvasUseNormalizedRealtime`：
    - `useAppServerEvents.test.tsx` 中 enable/disable 双用例同时通过
  - `chatCanvasUseUnifiedHistoryLoader`：
    - `useThreadActions.test.tsx` 中 unified loader 启用路径通过
    - fallback warning 与主链路兜底路径通过
  - `chatCanvasUsePresentationProfile`：
    - `Messages.test.tsx` 中 profile 注入路径通过
    - 关闭 profile 时行为维持通用语义
- 结论：任一单 flag 关闭后，消息/工具/计划/提问/历史恢复主链路仍可用。
