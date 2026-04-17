## ADDED Requirements

### Requirement: Submitted Text Snapshot Integrity

Composer MUST 以用户触发提交时的最新编辑器文本快照为准，不得在父层重新读取过时的 debounce 状态。

#### Scenario: enter submit uses latest editor snapshot

- **WHEN** 用户在输入框输入文本后立刻按下发送快捷键
- **THEN** 系统 MUST 发送提交当刻的最新文本快照
- **AND** MUST NOT 因 debounce 延迟而发送空文本或旧文本

#### Scenario: click submit uses same snapshot as keyboard submit

- **WHEN** 用户点击发送按钮提交
- **THEN** 系统 MUST 与快捷键提交使用同一份文本快照与附件快照
- **AND** 两条路径 MUST 具有一致的发送结果

### Requirement: IME-Safe Submit Semantics

Composer MUST 正确处理 IME 提交完成前后的发送时序，避免 CJK 输入场景下误发或漏发。

#### Scenario: committed ime text is sent exactly once

- **WHEN** 用户在 IME 输入结束后立即触发发送
- **THEN** 系统 MUST 发送已确认的最终文本
- **AND** MUST 仅发送一次

#### Scenario: active composition does not trigger premature empty submit

- **WHEN** 输入框仍处于活动 composition 状态
- **THEN** 系统 MUST NOT 把未确认内容当作正式提交
- **AND** MUST NOT 因提交流程而清空为一次空发送

### Requirement: Clear-After-Accepted Snapshot

输入框清空与父层发送 MUST 共享同一份已接受的提交快照，不得出现“清空成功但消息未真正进入发送链路”。

#### Scenario: clear input does not drop accepted submit

- **WHEN** 系统在提交后立即清空输入框以提升响应速度
- **THEN** 父层发送逻辑 MUST 仍收到原始提交快照
- **AND** 消息 MUST 继续进入正常发送流程

#### Scenario: empty snapshot without attachments is ignored

- **WHEN** 提交快照为空
- **AND** 当前没有任何附件需要发送
- **THEN** 系统 MUST 忽略本次发送动作
- **AND** MUST NOT 产生伪用户消息或空请求
