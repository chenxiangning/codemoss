## ADDED Requirements

### Requirement: Codex History Replay Restores Collaboration Parent-Child Links

`Codex` 历史回放 MUST 恢复可用于线程拓扑构建的协作父子关系，保证 reopen 后生命周期语义与实时阶段连续。

#### Scenario: replay reconstructs parent-child relation from collaboration tool facts

- **WHEN** `Codex` 本地历史包含协作调用（例如创建子会话或向子会话发送指令）
- **THEN** 历史回放 MUST 产出可恢复 parent-child 的结构化事实
- **AND** reopen 后线程关系 MUST 支持 root-subtree 聚合，不得丢失已建立 child links

#### Scenario: unified history loader applies reconstructed links before lifecycle consumers read state

- **WHEN** unified history loader 完成 `Codex` 会话 items 恢复
- **THEN** 系统 MUST 在生命周期消费者读取状态前完成 thread links 回填
- **AND** `session activity`、会话列表与其他读取方 MUST 看到一致的线程关系

#### Scenario: codex-specific link restoration does not regress other engines

- **WHEN** 当前引擎为 `Claude` 或 `OpenCode`
- **THEN** 本恢复策略 MUST NOT 改变其既有生命周期行为
- **AND** 既有跨引擎一致性约束 MUST 继续成立
