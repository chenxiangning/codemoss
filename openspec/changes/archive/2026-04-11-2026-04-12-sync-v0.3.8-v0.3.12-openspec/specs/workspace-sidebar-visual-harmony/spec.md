## MODIFIED Requirements

### Requirement: Thread Pin Toggle Interaction MUST Be Hover-Revealed and Non-Disruptive

根线程行的 pin/unpin 入口 MUST 在悬停或键盘聚焦时显示，且 pin 操作不得误触发线程切换。

#### Scenario: root thread rows reveal pin toggle on hover/focus only

- **WHEN** 用户悬停或聚焦根线程行
- **THEN** 系统 MUST 显示图钉切换入口
- **AND** 非根线程行 MUST NOT 显示该入口

#### Scenario: clicking pin toggle does not select thread

- **WHEN** 用户点击图钉切换入口
- **THEN** 系统 MUST 仅执行 pin/unpin 状态切换
- **AND** MUST NOT 触发线程选中或导航

#### Scenario: unpin from pinned section updates lists without stale duplicates

- **WHEN** 用户在固定区点击某线程的 `Unpin`
- **THEN** 该线程 MUST 从固定区移除并回到常规线程列表
- **AND** 系统 MUST NOT 保留残留项或产生重复行
