## Why

GitHub issue [#146](https://github.com/zhukunpenglinyutong/mossx/issues/146)（创建于 2026-03-02）反馈：会话中的“运行命令”和“File changes”信息在应用重启后消失，导致用户无法回看执行证据与改动上下文。

同时，当前幕布内 `批量编辑文件` 已支持点击文件打开 Git diff，但 `File changes` 列表仍不可点，造成同类文件变更入口行为不一致，与统一文件详情交互目标不一致。

## 目标与边界

- 目标：
  - 让 `File changes` 文件行支持点击并复用现有 Git 模块 diff 弹出面板。
  - 让 `commandExecution` 与 `fileChange` 卡片在重启后可稳定恢复（跨会话重载可见）。
  - 保持多引擎（Claude/Codex/OpenCode）在“实时渲染 vs 历史回放”上的行为一致。
- 边界：
  - 仅覆盖会话幕布中的工具卡片（tool items）展示与恢复，不扩展到 git history 业务面板能力。
  - 仅复用现有 diff 展示链路，不新增第二套 diff UI。

## What Changes

- 为 `File changes` 卡片的文件行增加可点击交互，点击后走统一 `onOpenDiffPath` 链路，打开 Git diff 视图/弹层并定位目标文件。
- 补齐 `commandExecution` 与 `fileChange` 在会话持久化与历史回放链路中的一致性约束，确保“实时出现的卡片”在重启后仍可恢复展示。
- 增加重启回归与跨引擎一致性验证用例，覆盖“实时 -> 落库 -> 重启 -> 历史回放”链路。

## 非目标

- 不改造 Git diff 渲染器本身（如新增全新布局、编辑能力、评论能力）。
- 不处理与本诉求无关的消息卡片视觉重构。
- 不引入新的会话存储后端（继续使用现有存储机制）。

## 技术方案对比

### 方案 A：仅前端点击增强（不调整持久化契约）

- 做法：只给 `File changes` 增加点击打开 diff。
- 优点：改动小、落地快。
- 缺点：无法解决 issue #146 的核心痛点（重启后丢失），只能修复半个问题。

### 方案 B：点击增强 + 工具卡片持久化契约收敛（推荐）

- 做法：在保持现有 diff 复用的同时，补齐 `commandExecution/fileChange` 的持久化与回放一致性，并增加回归验证。
- 优点：一次性解决“可点”和“可回看”两类用户体验断裂，且符合跨引擎统一契约。
- 缺点：涉及适配器/归一化/回放链路，验证面更大。

取舍：采用方案 B。

## Capabilities

### New Capabilities
- `conversation-tool-card-persistence`: 定义并约束 `commandExecution` 与 `fileChange` 工具卡片的重启可恢复语义，确保会话历史可回放。

### Modified Capabilities
- `conversation-template-maintenance`: 增加 `File changes` 文件行点击打开统一文件详情（Git diff）交互要求。
- `conversation-lifecycle-contract`: 将“重启可验证”从会话列表生命周期扩展到关键工具卡片可见性语义。

## Impact

- Frontend
  - 对话幕布工具卡片渲染链路（`Messages` / `ToolBlockRenderer` / `GenericToolBlock`）
  - diff 打开入口复用（`onOpenDiffPath` 透传与路径归一化）
- Conversation data pipeline
  - 实时事件映射、历史回放与 item 归一化契约（`fileChange` / `commandExecution`）
- QA/Test
  - 新增或增强跨引擎 parity 与重启恢复回归测试

## 验收标准

- 用户在 `File changes` 卡片点击任意文件行，系统可打开 Git diff 面板并定位到目标文件。
- 同一线程中出现过的 `commandExecution` 与 `fileChange` 卡片，在应用重启后进入历史详情页仍可见。
- Claude/Codex/OpenCode 三引擎在上述行为上表现一致（实时与历史路径无分叉）。
- 对 malformed file path 或缺失 payload 的点击链路提供可恢复提示，不导致应用崩溃。
