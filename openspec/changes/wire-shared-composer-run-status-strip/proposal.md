## Why

Composer 上方 **Run Status Strip**（已编辑文件 / 子代理 / 任务 / Plan pills，含撤销全部）已在 2026-08-07 由 run-status 改造落地，但 Shared Session **普通模式与协作模式**均几乎看不到：数据只扫 Composer 的 `items`，而根布局为控渲染把空数组传给 Composer props、真数据经 ActiveCanvas 覆盖；协作写文件发生在 **agent-canvas:{shared}:{attempt}** 隔离键，主幕 `items` 无工具变更，strip 永远 `visible=false`。

## 目标与边界

- Shared **普通模式**：用当前会话主时间线 + 子线程工具事实驱动 strip（与 Native 同卡片 UI）。
- Shared **协作模式**：额外 fan-in 当前 shared 下全部 `agent-canvas:*` 节点 attempt 的 tool/fileChange，汇总「已编辑」。
- 撤销全部 / 单文件撤销继续走既有 git restore 回调（`onRevertGitFile` / `onRevertGitPaths`）。
- 不恢复底部 legacy status dock；不破坏 ActiveCanvas 根渲染隔离（禁止把全量 items 绑回 AppShell 根 props）。

## What Changes

- 新增 `collectRunStatusSourceItems`：主 items ∪ agent-canvas ∪ 子会话 items。
- Composer：`sessionFileChanges` / `useStatusPanelData` 使用上述合成 items，而非裸 `performanceScopedItems`。
- OpenSpec + 基石设计校准行（Composer run-status 数据面）。
- 单测：canvas fan-in、空主线有 canvas 时仍出编辑 pill。

## 非目标

- 不改 strip 视觉结构（pill + 展开面板）。
- 不把 worker 工具投影回主幕 Messages 时间线。
- 不做跨 workspace 编辑汇总。

## 方案取舍

| 选项 | 说明 | 取舍 |
|------|------|------|
| A 把 activeItems 直接绑 Composer props | 破坏根渲染隔离 | 否 |
| **B 合成 run-status 源 items（选定）** | 仅 status 派生用，不改 Messages | 是 |
| C 另建 git dirty 列表 | 与会话回合卡口径不一致 | 否（撤销仍 git） |

## Capabilities

### New Capabilities

- `composer-run-status-shared-source`: Shared/协作下 run-status strip 的数据源契约。

### Modified Capabilities

- （无强制改 main multi-agent 行为 spec；协作仅消费 agent-canvas 已有隔离事实）

## Impact

- `src/features/composer/**`、可能 `multi-agent/runtime/agentCanvasThread`
- 基石 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 校准表

## 验收标准

- Shared 普通：有 fileChange/edit 工具时 strip 出现「已编辑」且可展开/撤销。
- Shared 协作：实现节点写文件后，主 Composer 上 strip 汇总各节点变更（不要求主幕出现工具卡）。
- 无活动时 strip 不占位。
- 根渲染仍不因 strip 派生把高频 items 挂回 AppShell 空 props 路径。
