# composer-manual-memory-reference Specification (delta · Phase-3)

## Purpose

Composer 记忆参考菜单与持久化 session 策略、dismiss 恢复对齐。

## ADDED Requirements

### Requirement: 菜单反映持久化模式

系统 MUST 使 Composer 记忆参考菜单勾选状态与当前 thread 已恢复的 session 策略一致。

#### Scenario: 重启后菜单勾选

- **GIVEN** 持久化策略为 always
- **WHEN** 用户打开该 thread 的 Composer 记忆参考菜单
- **THEN** 菜单 SHALL 显示 always 为当前选择（或等价可感知状态）

### Requirement: 从菜单恢复 dismissed

系统 MUST 允许用户从 Composer 侧结束 dismissed 静音。

#### Scenario: 恢复后可再消费

- **GIVEN** thread 为 dismissed
- **WHEN** 用户通过 Composer 执行恢复记忆参考
- **THEN** dismissed SHALL 为 false
- **AND** 用户再次发送时系统 MAY 再次进入记忆挑选/参考路径（依恢复后 mode）
