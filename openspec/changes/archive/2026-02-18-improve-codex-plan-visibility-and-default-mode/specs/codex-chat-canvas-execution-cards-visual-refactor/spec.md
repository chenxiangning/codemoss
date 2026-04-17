# codex-chat-canvas-execution-cards-visual-refactor Specification Delta

## MODIFIED Requirements

### Requirement: Batch Edit Overview and Drill-down

`批量编辑文件` 卡片中的 Plan 快览 MUST 完整展示并支持滚动下钻，避免信息截断。

#### Scenario: batch edit plan preview is not clipped

- **WHEN** 批量编辑卡片关联的计划步骤较长
- **THEN** 快览容器 MUST 不得裁切关键内容
- **AND** 用户 MUST 能滚动查看全部步骤

#### Scenario: preview and right panel stay semantically consistent

- **WHEN** 用户在批量编辑卡片查看 Plan 快览
- **THEN** 快览中的步骤顺序与状态 MUST 与右侧 Plan 面板一致
- **AND** 不得出现“快览缺项、面板完整”的信息分裂

### Requirement: Codex Activity and Detail Summary Consistency

Codex 幕布中的实时活动文案与详情卡片 MUST 基于同一摘要规则，以减少同一步骤的语义偏差并提升信息完整度。

#### Scenario: codex realtime label prefers executable fact with context

- **GIVEN** 当前引擎为 `codex`
- **AND** 同一步骤同时存在 reasoning 与 command/tool 事实
- **WHEN** 渲染实时活动标签
- **THEN** 标签 MUST 优先展示 command/tool 可执行事实摘要
- **AND** MAY 追加 reasoning 作为次级上下文

#### Scenario: codex detail card and realtime label share summary source

- **GIVEN** 当前引擎为 `codex`
- **WHEN** 渲染详情卡片标题与实时活动标签
- **THEN** 两者 MUST 共享同一摘要拼装规则
- **AND** 不得出现明显语义冲突（例如一个只显示“Planning…”，另一个只显示命令且无关联）

#### Scenario: non-codex engines remain unchanged

- **WHEN** 当前引擎为 `claude` 或 `opencode`
- **THEN** 本摘要合并策略 MUST NOT 改变其现有展示行为
