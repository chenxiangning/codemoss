## ADDED Requirements

### Requirement: Codex History Reopen Preserves Child Session Topology

对于 `Codex` 会话，`session activity` 在历史 reopening 场景 MUST 保持与实时阶段一致的子会话拓扑，不得仅展示 root session。

#### Scenario: history reopen keeps previously visible child sessions

- **GIVEN** 某个 `Codex` 会话在实时阶段出现过至少一个 child session
- **WHEN** 用户关闭后重新打开该会话
- **THEN** `session activity` MUST 继续显示这些 child sessions
- **AND** 相关 child session 的关键活动 MUST 仍可在聚合时间线中被查看

#### Scenario: topology recovery uses persisted collaboration facts when direct parent map is sparse

- **GIVEN** 历史恢复时 `threadParentById` 不完整
- **AND** 历史记录中存在可解析的协作调用事实
- **WHEN** 面板构建 root-subtree 相关线程范围
- **THEN** 系统 MUST 基于这些协作事实恢复 child session 归属
- **AND** MUST NOT 将已执行过的 child session 误判为无关线程

#### Scenario: no fabricated child session in root-only history

- **GIVEN** 某个 `Codex` 会话历史中从未创建 child session
- **WHEN** 用户打开 `session activity`
- **THEN** 面板 MUST 仅展示 root session
- **AND** 系统 MUST NOT 伪造不存在的 child session 关系
