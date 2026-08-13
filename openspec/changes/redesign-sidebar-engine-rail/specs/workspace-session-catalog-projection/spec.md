## ADDED Requirements

### Requirement: Sidebar membership MUST follow Session Index tombstones

侧栏活跃 membership MUST 忽略 Session Index 中已 tombstone 的行。Catalog 仍是 Session Management 的归属真相，但 MUST NOT 把已 tombstone 的 Index 行投影回普通侧栏。

#### Scenario: tombstoned index row stays off the sidebar

- **WHEN** Session Index 中某 `(engine, session_id)` 带有 `tombstoned_at`
- **AND** 侧栏执行普通 Index hydrate
- **THEN** 该行 MUST NOT 出现在侧栏列表
- **AND** writer upsert MUST NOT 清除 tombstone 或复活该行

### Requirement: Sidebar delete MUST tombstone Index before disk cleanup

用户从侧栏删除会话时，系统 MUST 先写入 Index tombstone（或删除 Index 行并留下 tombstone 标记），使下一次 Index list 不再返回该行；然后再尽力删除磁盘产物。磁盘删除失败 MUST NOT 撤销 tombstone。

#### Scenario: disk delete failure does not restore the row

- **WHEN** 用户删除一条侧栏会话
- **AND** 对应磁盘删除返回错误
- **THEN** 侧栏 MUST 立即不再显示该行
- **AND** 下一次 Index hydrate MUST 仍不显示该行
- **AND** Session Management MAY 暴露磁盘残留，但 MUST NOT 把它当作普通活跃侧栏行
