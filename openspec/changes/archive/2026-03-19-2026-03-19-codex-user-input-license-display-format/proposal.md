## Why

当前用户气泡在展示多行/结构化输入时，会丢失用户原始输入格式（如换行、空行、缩进、列表节奏），导致“输入时看起来是 A，发出后展示成 B”。  
这属于前端显示层保真问题，不是后端协议问题；如果继续保持现状，会持续放大用户对输入是否正确送达的怀疑成本。

## 目标与边界

- 目标：在用户消息气泡中实现“输入格式保真展示”，用户怎么输入就怎么显示。
- 目标：保持现有 `[System] ... [User Input] ...` 提取逻辑不变，继续只展示用户实际输入部分。
- 目标：仅改前端渲染显示，不修改消息存储文本、发送协议或后端行为。
- 边界：本次仅覆盖用户消息气泡渲染链路（`Messages` / `CollapsibleUserTextBlock`），不改 assistant markdown renderer。
- 边界：本次不引入新的后端字段，不新增消息 schema。

## 非目标

- 不修改 `useThreadMessaging` 的拼装规则。
- 不调整复制按钮的原始文本来源（复制仍以原文为准）。
- 不重构整个用户消息组件样式系统。
- 不把用户输入自动转成 Markdown 富渲染（本次只做文本格式保真，不做语义增强）。

## What Changes

- 在用户消息展示路径增加“用户输入格式保真”规则（display-only transform），确保换行/空行/缩进/列表节奏可见。
- 保持用户输入文本字符序列与结构边界，不做启发式拼接、压缩、重排。
- `license`、会议纪要、步骤清单等都按同一保真规则处理，不引入单一场景特判。
- 调整 Codex 外部 Spec 根上下文提示注入策略：仅在新会话首条消息自动拼接一次，后续同线程消息不再重复拼接。
- 为该行为补充回归测试，覆盖：
  - 多行列表与段落空行保留；
  - 缩进与编号层次保留；
  - `license` 作为示例场景可读展示；
  - 外部 Spec 根提示仅首条消息注入一次；
  - 已有 `[User Input]` 提取语义不回退。

## 技术方案对比

### 方案 A：仅补 license 特判格式化（不采纳）

- 优点：可以快速修复单一案例。
- 缺点：问题本质是“用户输入格式保真”而不是“license 特例”；单点特判会继续漏掉会议纪要、清单、流程文本等同类输入。
- 结论：不采纳。

### 方案 B：在用户消息显示链路做通用格式保真（采纳）

- 优点：从根上保证“所见即所输”，覆盖所有结构化输入场景。
- 优点：不污染后端与存储，仍保持 display-only。
- 优点：可通过单测稳定约束，不依赖浏览器换行细节。
- 缺点：需要补更系统的样本测试矩阵（不仅是 license）。
- 结论：采纳。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-collaboration-mode`：新增用户气泡“输入格式保真展示”要求，并明确该能力是 display-only，不得修改消息原文语义。

## 验收标准

1. 用户在输入框中的换行、空行、缩进和编号结构，发送后在用户气泡中 MUST 保持可见且顺序一致。
2. 展示格式化 MUST 仅作用于显示层，不得更改消息原始文本值。
3. 用户点击复制时，复制内容 MUST 继续与消息原始文本一致。
4. `license` 文本只是该能力的一个示例，系统 MUST 以通用规则处理所有结构化输入文本。
5. Codex 在配置外部 Spec 根目录时，`[Session Spec Link]` / `[Spec Root Priority]` 自动拼接 MUST 仅发生在新会话首条消息。
6. 同一 Codex 线程后续消息 MUST NOT 重复拼接上述 Spec 根上下文提示。
7. `[User Input]` 提取逻辑 MUST 保持既有语义，不得因本次改动发生回退。

## Impact

- Affected frontend:
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/CollapsibleUserTextBlock.tsx`
  - `src/features/messages/components/Messages.test.tsx`
  - 可能新增 `messages` 下的 display formatter 工具文件与单测（面向通用格式保真）
- APIs / backend:
  - 无新增 API
  - 不修改请求/响应协议
- Dependencies:
  - 无新增第三方依赖
