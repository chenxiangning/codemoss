## Context

- 当前会话幕布中，`批量编辑文件`（`EditToolGroupBlock`）已经支持点击文件名并走 `onOpenDiffPath` 打开 Git diff。
- `File changes`（`GenericToolBlock` 的 `fileChange` 渲染分支）当前只展示文件行与 `+/-` 统计，不支持点击打开 diff。
- `onOpenDiffPath` 现有链路已经具备路径归一化与视图切换能力：`Messages -> useLayoutNodes(handleOpenDiffPath) -> onSelectDiff`。
- GitHub issue #146（2026-03-02）反馈 `commandExecution` 与 `fileChange` 在重启后丢失，说明实时渲染与历史回放在工具卡片语义上存在不一致风险。

## Goals / Non-Goals

**Goals:**
- 为 `File changes` 文件行补齐点击打开 diff 的统一入口能力，复用现有 `onOpenDiffPath` 管线。
- 保证 `commandExecution` 与 `fileChange` 在“实时出现 -> 落库 -> 重启 -> 历史回放”链路中可恢复。
- 维持 Claude/Codex/OpenCode 三引擎一致语义。
- 明确非回归边界：不得改变被复用 Git diff 组件的原有行为。

**Non-Goals:**
- 不重构 Git diff 组件（`GitDiffPanel` / `GitDiffViewer`）内部交互与展示逻辑。
- 不新增第二套文件 diff 弹窗体系。
- 不扩展与本次无关的消息卡片视觉设计。

## Decisions

### Decision 1: 复用现有 diff 打开链路，仅在消息工具卡片侧补齐入口

- 方案：在 `ToolBlockRenderer/GenericToolBlock` 透传并消费 `onOpenDiffPath`，将 `File changes` 的文件名改为可点击触发。
- 原因：现有 `handleOpenDiffPath` 已处理路径解析、树视图切换与选中文件，复用可避免重复实现。
- 备选：
  - 备选 A：新增会话专用 diff modal 组件。
  - 不选原因：会造成第二套 diff 交互协议，增加维护成本与行为漂移风险。

### Decision 2: 将工具卡片持久化作为会话生命周期契约的一部分

- 方案：统一要求 `commandExecution` 与 `fileChange` 在实时和历史路径均使用同一 `ConversationItem` 语义，并在重启后可回放。
- 原因：issue #146 的本质是“实时可见但历史不可恢复”，属于生命周期契约断裂，不是单点 UI 问题。
- 备选：
  - 备选 A：仅针对单引擎做临时补丁。
  - 不选原因：会引入跨引擎行为分叉，与当前契约目标冲突。

### Decision 3: 设定“复用组件行为不变”的硬门禁

- 方案：点击能力仅新增在 `File changes` 文件条目，不改 Git diff 组件默认 diff 样式、工具栏语义、已有快捷入口。
- 原因：满足本次约束“不要改变被引用组件原有行为”，将改动限制在调用方适配层。
- 备选：
  - 备选 A：点击时强制覆盖 diff 组件状态（例如强制统一 view style）。
  - 不选原因：会破坏已存在的用户偏好与组件契约。

## Risks / Trade-offs

- [Risk] `File changes` 文件路径在当前 diff 列表不可解析（重命名/路径映射差异）
  - Mitigation: 继续复用 `resolveDiffPathFromToolPath`；失败时给出可恢复提示，不抛异常。
- [Risk] 工具卡片持久化引入数据量增长
  - Mitigation: 延续现有截断策略，仅对关键类型维持必要字段完整性。
- [Risk] 跨引擎 adapter 行为漂移
  - Mitigation: 增补 realtime/history parity 测试，覆盖三引擎同场景断言。

## Migration Plan

1. 先落 spec 与测试门禁，明确“入口新增 + 行为不变 + 重启可恢复”的验收规则。
2. 实施时先改消息卡片入口（低风险），再做持久化链路修正（中风险）。
3. 回归通过后逐步发布；若出现回归，可仅回滚入口适配层，不影响 Git diff 组件主逻辑。

## Open Questions

- 当 `File changes` 点击路径无法命中当前 diff 列表时，是否需要自动降级到文件只读预览？（当前建议先提示并保持会话可用）
- `commandExecution` 输出的持久化上限是否需要按 workspace 可配置？（本提案先不引入配置项）
