## ADDED Requirements

### Requirement: 跨引擎会话生命周期契约必须统一

系统 MUST 为 Claude、Codex、OpenCode 定义统一生命周期语义（删除、最近会话排序、重启恢复可见性）。

#### Scenario: lifecycle contract applies to all engines

- **WHEN** 系统执行会话生命周期相关操作
- **THEN** 行为语义 MUST 在三类引擎中保持一致
- **AND** 引擎差异 MUST 仅存在于内部执行适配层

### Requirement: 用户可见删除语义必须与可复验结果一致

系统 MUST 保证 UI 删除结果与重启后可见性一致，不得出现“删除成功但重启回魂”。

#### Scenario: delete result is restart-verifiable

- **WHEN** 用户删除会话且收到成功回执
- **THEN** 当前列表 MUST 移除目标会话
- **AND** 重启后该会话 MUST NOT 再次出现

### Requirement: 最近会话排序信号必须可重建

系统 MUST 使用可重建时间信号排序最近会话，避免仅依赖内存活动缓存。

#### Scenario: ordering remains stable after restart

- **WHEN** 应用重启并重新加载最近会话
- **THEN** 会话顺序 MUST 与同一排序规则下的预期一致
- **AND** MUST NOT 依赖单次进程内状态作为唯一依据
