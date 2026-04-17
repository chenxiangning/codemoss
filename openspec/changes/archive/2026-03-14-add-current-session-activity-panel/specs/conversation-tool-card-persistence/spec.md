# conversation-tool-card-persistence Specification Delta

## MODIFIED Requirements

### Requirement: Realtime-History Semantic Equivalence For Tool Cards

Tool card 语义在 realtime rendering、history replay 与右侧 activity panel 之间 MUST 保持等价，不得对同一操作生成冲突摘要。

#### Scenario: tool card and activity panel share file-change summary facts

- **WHEN** 同一条 `fileChange` 事实同时出现在消息区 tool card 与右侧 activity panel
- **THEN** 两处展示 MUST 共享同一文件路径与增删摘要事实
- **AND** 不得出现文件数、增删统计或目标路径互相矛盾

#### Scenario: tool card and activity panel share command execution identity

- **WHEN** 同一条 `commandExecution` 事实同时出现在消息区 tool card 与右侧 activity panel
- **THEN** 两处展示 MUST 指向同一个命令身份与运行状态
- **AND** activity panel SHOULD 通过跳转复用已有命令详情视图，而不是自建一套平行详情模型
