# codex-chat-canvas-collaboration-mode Specification Delta

## ADDED Requirements

### Requirement: Codex Assistant Reply De-duplication

在 Codex 模式下，同一 assistant turn 的最终渲染文本 MUST 不得出现整句或段落级重复拼接。

#### Scenario: duplicate stream chunks are merged into one final reply

- **WHEN** 同一 assistant turn 接收到语义重复的流式片段
- **THEN** 系统 MUST 在最终消息中去重
- **AND** 用户可见回复 MUST 仅保留一份有效文本

#### Scenario: short greeting turn is rendered once

- **WHEN** 用户发送简短问候（例如 `你好`）
- **THEN** 助手最终回复 MUST 只出现一次
- **AND** MUST NOT 出现同一问候语重复拼接

#### Scenario: deduplication does not change non-codex behavior

- **WHEN** 当前活动引擎为 `claude` 或 `opencode`
- **THEN** 本去重策略 MUST NOT 改变其既有渲染行为
