# memory-pick-gate Specification (delta · Phase-3)

## Purpose

Phase-3：session 习惯持久化与 dismiss 恢复；不改变闸门时序主合同。

## ADDED Requirements

### Requirement: Session 策略可持久化

系统 MUST 能将 Memory Pick 的 session 级策略在客户端重启后恢复，且作用域不得串 workspace。

#### Scenario: 刷新后保持 always

- **GIVEN** 用户将记忆参考设为 always 并完成至少一次闸门确认
- **WHEN** 客户端完全退出后重新打开同一 workspace 与 thread
- **THEN** 系统 SHALL 恢复 always 策略（含 alwaysPreferredCount 若已记忆）
- **AND** 下一发送仍按 always 合同 show-ui（非静默直注）

#### Scenario: dismissed 跨重启仍静音

- **GIVEN** 用户在闸门选择本 session 不再提示
- **WHEN** 客户端重启后在同一 thread 发送
- **THEN** 系统 SHALL NOT 再展示挑选闸门
- **UNTIL** 用户显式恢复记忆参考

#### Scenario: workspace 隔离

- **GIVEN** thread A 为 always，thread B 为 off
- **WHEN** 用户在两 thread 间切换
- **THEN** 各 thread 的 composerMode / dismissed 状态 SHALL 互不影响

### Requirement: Dismiss 可恢复

系统 MUST 提供用户可见的恢复入口，使 dismissed session 重新进入记忆参考消费路径。

#### Scenario: Composer 恢复入口

- **GIVEN** 当前 thread 处于 dismissed
- **WHEN** 用户打开 Composer 记忆参考菜单
- **THEN** 系统 SHALL 展示可恢复记忆参考的操作
- **AND** 用户执行恢复后，后续发送 MAY 再次进入挑选闸门（按恢复后的 mode 合同）
