## ADDED Requirements

### Requirement: Sidebar delete MUST settle organization state before disk IO

侧栏删除的用户可见结果 MUST 由组织态（Session Index tombstone + 当前列表剔除）决定。磁盘 IO 是尽力清理。磁盘失败 MUST 保持删除已 settle，MUST NOT 用 last-good / catalog fallback 把该会话救回活跃列表。

#### Scenario: settled sidebar delete survives restart even if disk remains

- **WHEN** 用户删除会话且 UI 已显示成功
- **AND** 磁盘文件仍存在
- **THEN** 重启后普通侧栏 MUST 仍不显示该会话
- **AND** 该会话 MUST NOT 仅因磁盘文件仍在而被 Index writer 复活
