## ADDED Requirements

### Requirement: 项目折叠态 MUST 保持会话状态信号可见
系统 MUST 在 workspace/worktree 折叠态下保持会话状态信号可见，确保用户无需展开线程列表也能感知运行状态。

#### Scenario: collapsed workspace shows running signal
- **GIVEN** 某 workspace 或其 worktree 下存在至少一个进行中会话
- **WHEN** 该 workspace 处于折叠态
- **THEN** 对应 workspace 行 MUST 显示进行中状态信号
- **AND** 信号 MUST 不依赖子线程列表是否展开

#### Scenario: collapsed workspace shows recent-complete hint
- **GIVEN** 某 workspace 下有会话在近期窗口内完成
- **WHEN** 用户查看折叠态项目树
- **THEN** 对应 workspace 行 MUST 提供最近完成提示
- **AND** 提示 SHALL 在超过定义窗口后自动衰减

### Requirement: 项目级信号 MUST 反映 worktree 汇总状态
系统 MUST 将主 workspace 与其 worktree 会话状态做聚合，避免用户遗漏子工作树中的活跃会话。

#### Scenario: worktree running contributes to parent workspace indicator
- **GIVEN** 主 workspace 自身无进行中会话
- **AND** 其任一 worktree 存在进行中会话
- **WHEN** 侧栏渲染主 workspace 行
- **THEN** 主 workspace 行 MUST 呈现进行中信号

#### Scenario: all worktrees idle clears parent running indicator
- **WHEN** 主 workspace 及其所有 worktree 均无进行中会话
- **THEN** 主 workspace 行 MUST 清除进行中信号
- **AND** 不得残留过期运行态样式
