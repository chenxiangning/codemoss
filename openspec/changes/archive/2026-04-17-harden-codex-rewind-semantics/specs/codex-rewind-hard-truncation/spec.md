## ADDED Requirements

### Requirement: Codex Rewind MUST Hard-Truncate Runtime And Persistent Facts

Codex rewind 执行成功后，系统 MUST 在会话事实层执行真实截断；锚点之后的数据在运行时内存与持久化存储中都不可再读取。

#### Scenario: rewind success means runtime + disk truncation committed

- **WHEN** 用户对 Codex 会话执行 rewind 并收到成功结果
- **THEN** 系统 MUST 已完成锚点之后事实数据的截断提交
- **AND** 该提交 MUST 同时覆盖运行时会话状态与持久化记录
- **AND** 系统 MUST NOT 以仅 UI 隐藏作为成功条件

#### Scenario: rewind failure stays recoverable without fake success

- **WHEN** 截断提交失败或无法确定有效锚点
- **THEN** 系统 MUST 返回可恢复错误
- **AND** 系统 MUST 保持原会话事实不变
- **AND** 系统 MUST NOT 回退为 UI-only 成功

### Requirement: Codex Post-Rewind Lifecycle MUST Read Truncated Facts Only

rewind 后所有生命周期链路 MUST 以截断后事实为唯一基线，不得复现锚点后数据。

#### Scenario: reopen after rewind does not restore tail facts

- **WHEN** 用户 rewind 后重新打开同一会话
- **THEN** 系统 MUST 仅返回锚点及其之前事实
- **AND** 锚点后消息与活动 MUST NOT 再出现

#### Scenario: restart and history reload keep truncation semantics

- **WHEN** 用户 rewind 后重启应用并执行 reopen 或本地 history reload
- **THEN** 系统 MUST 仍只读取截断后事实
- **AND** 本地恢复流程 MUST NOT 重新引入锚点后数据

#### Scenario: first send after rewind uses truncated context

- **WHEN** 用户在 rewind 成功后发送下一条消息
- **THEN** 系统 MUST 仅基于截断后上下文续写
- **AND** 系统 MUST NOT 隐式继承任何已回退尾部消息

### Requirement: Codex Rewind Semantics MUST Align With Claude On Effective Rewind

在“回退是否真实生效”这一语义点上，Codex MUST 与 Claude 保持一致：成功即事实截断，回退尾部不可重现。

#### Scenario: parity on effective rewind semantics

- **WHEN** 分别在 Claude 与 Codex 对等会话执行 rewind 并成功
- **THEN** 两者都 MUST 满足“锚点后事实不可通过 reopen / replay / send 重新读取”
