# codex-chat-canvas-execution-cards-visual-refactor Specification Delta

## MODIFIED Requirements

### Requirement: Codex Activity and Detail Summary Consistency

Codex 的实时活动标签、详情卡片与右侧 workspace activity panel MUST 基于同一摘要规则，优先表达可执行事实并保持跨视图语义一致。

#### Scenario: codex activity panel reuses executable-first summary rule

- **GIVEN** 当前引擎为 `codex`
- **AND** 同一步骤同时存在 reasoning 与 command/tool 事实
- **WHEN** 渲染右侧 workspace activity panel 的事件摘要
- **THEN** 摘要 MUST 优先展示 command/tool 可执行事实
- **AND** MAY 追加 reasoning 作为次级上下文

#### Scenario: chat realtime label detail card and activity panel stay semantically aligned

- **GIVEN** 当前引擎为 `codex`
- **WHEN** 同一执行步骤在实时标签、详情卡片与右侧 activity panel 中同时出现
- **THEN** 三处 MUST 共享同一摘要拼装规则
- **AND** 不得出现明显语义冲突或状态对不上的情况
