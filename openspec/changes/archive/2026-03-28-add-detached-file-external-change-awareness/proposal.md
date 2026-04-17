## Why

独立文件窗口在“文件已打开但被外部进程改写”场景下，如果没有持续感知，会让用户看到滞后内容并误判写入结果。  
尤其在 AI 连续写文件时，缺少即时反馈会造成“改了但看不到”的认知断层，并带来 dirty 缓冲区被误覆盖风险。

## 现状校准（2026-03-28）

当前代码已实现的基线能力（可复核）：

- detached 文件窗口在聚焦时启用外部变更 polling。
- clean buffer 检测到磁盘更新后自动同步，并显示非阻塞提示。
- dirty buffer 检测到磁盘更新后进入冲突提示，提供 `Reload / Keep Local / Compare`。
- 能力作用域限定在 detached 窗口上下文（不会修改主窗口全局行为）。

当前尚未落地（与原提案目标存在差距）：

- Rust watcher -> IPC 事件主链路。
- 结构化事件 payload（`normalizedPath/mtimeMs/size/workspaceId`）契约与配套测试。
- 显式 FSM 模块（当前仍是组件内状态组合）。
- feature flag 回滚开关（settings + runtime wiring）。
- Rust 侧 external_changes 模块及其测试。

## Goals（优化后）

- 保持已上线的 polling 基线稳定可用，不回退 clean/dirty 安全语义。
- 在不破坏现有行为前提下，增量引入 watcher 主链路与 polling fallback。
- 将外部改动处理从“组件内隐式状态组合”收敛为“可测试 FSM”。
- 建立可回滚开关与可观测日志，确保线上问题可降级。

## Non-Goals

- 不实现多人实时协同编辑（OT/CRDT）。
- 不实现自动 merge / 三方冲突求解。
- 不扩展到主窗口全部编辑器，仅覆盖 detached 文件窗口。

## What Changes（分阶段）

### Phase A（已完成基线，保持稳定）

- detached + polling 外部感知。
- clean 自动同步 + 非阻塞提示。
- dirty 冲突保护 + compare 决策入口。

### Phase B（下一阶段增量）

- Rust watcher 事件桥接（主链路）+ polling fallback（兜底）。
- 事件归一与去重（Win/mac 语义）。
- 前端显式 FSM 模块化与单测。
- feature flag（感知总开关 / watcher 开关）与设置页接入。

## Capabilities

### Modified Capabilities

- `independent-file-explorer-workspace`
  - 已具备：polling 感知 + clean 自动同步 + dirty 冲突保护（detached scope）。
  - 待补齐：watcher 主链路、事件归一去重、FSM 模块、回滚开关、Rust 侧测试。

## Risks & Mitigation

- 风险：高频写入导致提示密度上升。  
  方案：事件聚合节流 + 去重 + 上限计数展示。
- 风险：跨平台文件系统差异导致误判。  
  方案：把平台差异收敛到统一归一层，并补回放测试样例。
- 风险：主链路上线后出现异常抖动。  
  方案：保留 polling fallback + feature flag 快速降级。

## Impact

- Affected specs:
  - `openspec/specs/independent-file-explorer-workspace/spec.md`
- Affected frontend areas:
  - `src/features/files/components/DetachedFileExplorerWindow.tsx`
  - `src/features/files/components/FileExplorerWorkspace.tsx`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/externalChangeStateMachine.ts`（待新增）
  - `src/features/settings/components/SettingsView.tsx`（待接入开关）
- Affected backend areas:
  - `src-tauri/src/workspaces/external_changes.rs`（待新增）
  - `src-tauri/src/workspaces/commands.rs`
  - `src-tauri/src/state.rs`
  - `src-tauri/src/command_registry.rs`
