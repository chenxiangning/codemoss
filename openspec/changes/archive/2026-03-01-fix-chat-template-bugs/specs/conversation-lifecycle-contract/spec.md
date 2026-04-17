# conversation-lifecycle-contract Specification Delta

## ADDED Requirements

### Requirement: File Reference Click Safety Contract

会话消息中的文件引用点击链路 MUST 满足“可恢复失败”原则，不得导致应用崩溃。

#### Scenario: valid file reference click opens detail flow without interruption

- **WHEN** 用户点击会话消息中的有效文件引用
- **THEN** 系统 MUST 打开文件详情弹窗或等效详情流程
- **AND** 当前会话生命周期状态 MUST 保持连续（不重置、不退出）

#### Scenario: malformed file reference click does not crash app

- **WHEN** 用户点击缺少必要字段的文件引用
- **THEN** 系统 MUST 显示可恢复提示并拒绝执行危险跳转
- **AND** 应用进程 MUST 保持存活且可继续交互

#### Scenario: click handler exception is contained

- **WHEN** 文件引用点击处理链路发生运行时异常
- **THEN** 异常 MUST 被边界捕获并记录
- **AND** 用户界面 MUST 回退到可继续操作状态
