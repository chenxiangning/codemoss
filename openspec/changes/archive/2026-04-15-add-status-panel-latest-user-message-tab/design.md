## Context

当前产品已经在右下角使用 `StatusPanel` 的 `dock` 形态承载 `任务 / 子代理 / 编辑 / Plan` 等状态信息；与此同时，代码中已经存在“从 `ConversationItem[]` 提取最后一条用户消息”的纯函数逻辑，但该逻辑目前主要服务于 session radar / 历史预览，而不是底部状态面板。

这次变更的核心约束有三个：

1. 只做右下角 `dock` 状态面板，不碰 popover 版状态面板。
2. 不修改幕布滚动、消息区或右侧 `session activity` 面板行为。
3. 避免继续把逻辑堆进超大文件，尤其是 `src/app-shell.tsx` 和 `src/features/layout/hooks/useLayoutNodes.tsx`。

## Goals / Non-Goals

**Goals:**

- 在 `dock` 状态面板中新增 `最新用户对话` Tab。
- 复用现有线程消息数据，稳定提取当前 thread 的最后一条用户消息。
- 为图片消息提供数量占位摘要，并为超长文本提供截断预览与展开能力。
- 对 `Claude / Codex / Gemini` 保持一致体验，且不改变现有默认 Tab 策略。
- 通过独立 selector + 独立内容组件实现，控制大文件膨胀风险。

**Non-Goals:**

- 不调整消息流滚动算法。
- 不实现“点击跳回原消息”“复制回输入框”“跨线程最近用户消息”。
- 不引入新的持久化结构，也不为本提案专门扩展消息存储模型。
- 不在本次交付中定义非图片附件类型的结构化占位语义。
- 不要求 popover 状态面板与 dock 状态面板在第一阶段保持完全对称。

## Decisions

### Decision 1：复用现有 `StatusPanel` 容器，新增 dock 专属 Tab

- 决策：在现有 `StatusPanel` 中新增 `latestUserMessage` 类型的 Tab，但仅在 `variant=\"dock\"` 时渲染。
- 原因：
  - 视觉位置和用户预期已经存在，不需要额外引入新容器。
  - 只改 `dock` 可以严格满足本次边界，避免同时扩散到 popover 路径。
- 替代方案：
  - 新建独立右下角面板：侵入更大，重复状态面板样式与挂载逻辑。
  - 同时改 `dock + popover`：范围扩大，超出当前提案边界。

### Decision 2：提取共享 selector，避免把消息解析逻辑塞回大组件

- 决策：将“最后一条用户消息 + 图片占位摘要”的拼装逻辑封装为独立纯函数，例如放在 `status-panel` 邻近的 util/selector 中；必要时复用或抽取 `sessionRadarPersistence.ts` 里的 `resolveLatestUserMessage`。
- 原因：
  - 当前 `ConversationItem` 已原生支持 `images?: string[]`，图片数量可直接复用现有消息模型。
  - 纯函数更容易单测，也能减少 `StatusPanel.tsx` 的条件分支膨胀。
- 替代方案：
  - 在 `StatusPanel.tsx` 内直接遍历 `items` 拼字符串：短期快，长期会让组件进一步膨胀并削弱复用。

### Decision 3：首期只承诺图片占位，非图片附件不进入本次验收

- 决策：首期必须支持 `ConversationItem.images` 的数量占位，例如 `含 2 张图片`；非图片附件类型不写入本次验收标准，也不为此扩展消息存储模型。
- 原因：
  - 当前线程消息模型中已有稳定的结构化 `images` 字段，这是可落地且零破坏的实现面。
  - 继续把“附件占位”写成首期承诺，会让 proposal/spec 与真实实现边界错位，导致验收口径失真。
- 替代方案：
  - 直接为附件新建持久化字段：会扩散到消息装配、历史加载与兼容链路，风险过高。

### Decision 4：默认截断为前 4 行，展开后仅在面板内部滚动

- 决策：长消息默认展示前 `4` 行，点击 `展开` 后在当前 Tab 内容区完整查看，内容区内部滚动，不影响面板其他 Tab。
- 原因：
  - 右下角面板高度有限，完整直出会挤压其他信息区。
  - 把规则明确成“前 4 行”后，样式、实现和测试都能对齐，不会出现“字符数还是行数”的歧义。
- 替代方案：
  - 始终展示全文：容易让面板高度失衡。
  - 只展示首行无展开：对长问题的信息恢复能力不足。

### Decision 5：保持默认 Tab 和其他功能不变

- 决策：新 Tab 不参与默认选中逻辑，不随新消息自动激活，也不改变既有 Tab 的统计和交互。
- 原因：
  - 这是“补一个稳定查看位”，不是重新定义状态面板主工作流。
  - 可最大程度降低对现有用户习惯和测试断言的冲击。

## Risks / Trade-offs

- [Risk] 图片占位和文本拼接规则不一致，可能导致预览读起来突兀。
  - Mitigation：把摘要拼装逻辑抽成纯函数，并为“纯文本 / 纯图片 / 文本+图片”分别补单测。

- [Risk] `StatusPanel.tsx` 再次变大，后续维护困难。
  - Mitigation：新增独立内容组件，如 `LatestUserMessagePanel.tsx`，`StatusPanel.tsx` 只负责 Tab 装配。

- [Risk] 在 `app-shell.tsx` 或 `useLayoutNodes.tsx` 中继续叠加派生逻辑，突破大文件治理红线。
  - Mitigation：主文件只透传既有 `items`，不新增新的线程级派生状态；派生逻辑下沉到 `status-panel` 邻近模块。

- [Risk] 现有测试多以 Tab 数量和文案为断言，新增 Tab 后可能造成快照或选择器失效。
  - Mitigation：同步更新 `StatusPanel.test.tsx`，并新增“默认不自动切换”“空态”“展开/收起”用例。

## Migration Plan

1. 新增 capability 文档与任务拆分，不改现有运行时行为。
2. 实现阶段先提取 selector / preview formatter，再新增独立内容组件。
3. 最后在 `StatusPanel` 中接入 Tab 与文案，并更新样式和测试。
4. 如果上线后发现 Tab 过于拥挤，可仅回退该 Tab 的渲染入口，不影响消息流、线程数据和其他状态面板能力。

## Open Questions

- 如果后续要纳入非图片附件摘要，需要先确认历史消息模型是否暴露稳定字段；这不阻塞本次提案进入实现。
