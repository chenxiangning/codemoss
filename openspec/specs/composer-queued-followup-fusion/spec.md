# composer-queued-followup-fusion Specification

## Purpose
TBD - created by archiving change codex-queued-followup-fusion. Update Purpose after archive.
## Requirements
### Requirement: Queued Follow-up Surface SHALL Match Composer Container Semantics

系统 MUST 将 composer 上方的排队消息区域渲染为与输入容器一致的组合式表面，而不是割裂的独立列表块。

#### Scenario: queued area keeps shared visual language with composer
- **WHEN** 当前线程存在至少一条排队消息
- **THEN** 系统 MUST 渲染排队容器并与下方 composer 保持一致的圆角、边框层级和背景语义
- **AND** 队列容器 MUST 视觉上属于同一输入组合区域

#### Scenario: queue items render as child cards inside shared surface
- **WHEN** 排队区域渲染多条队列项
- **THEN** 每条队列项 MUST 作为外层容器内的子卡片渲染
- **AND** 系统 MUST 避免出现外层圆角与内层 item 风格冲突的视觉断裂

### Requirement: Each Queued Follow-up SHALL Expose Dedicated Item Actions

系统 MUST 为每条排队消息提供独立动作入口，至少包含 `融合` 与 `删除`。

#### Scenario: queued item shows fuse and remove actions
- **WHEN** 队列项出现在当前活动线程的排队区域
- **THEN** 该队列项 MUST 提供 `融合` 按钮
- **AND** 该队列项 MUST 继续提供既有 `删除` 按钮

#### Scenario: unsupported runtime does not fake interactive fuse affordance
- **WHEN** 当前活动线程不满足融合条件
- **THEN** 系统 MUST NOT 展示“可点击且会成功”的假融合交互
- **AND** 融合入口 MUST 以禁用态或不可见方式表达不可用状态

### Requirement: Queued Follow-up Fusion SHALL Prefer Existing In-Run Follow-up Semantics

系统 MUST 优先复用当前引擎已存在的运行中 follow-up / steer 语义来完成融合，而不是默认执行显式中断。

#### Scenario: supported runtime uses same-run continuation as primary fusion path
- **GIVEN** 当前线程正在运行
- **AND** 当前引擎支持同轮 follow-up / steer
- **WHEN** 用户点击某条排队消息的 `融合`
- **THEN** 系统 MUST 通过现有的同轮 follow-up 路径发送该消息
- **AND** 系统 MUST NOT 把显式 interrupt 作为主路径

#### Scenario: safe cutover is used only when same-run continuation is unavailable
- **GIVEN** 当前线程正在运行
- **AND** 当前引擎不支持同轮 follow-up / steer
- **AND** 当前引擎支持安全 cutover
- **WHEN** 用户点击某条排队消息的 `融合`
- **THEN** 系统 MUST 使用该引擎支持的安全 cutover 路径使该消息立即生效
- **AND** 系统 MUST NOT 伪装成“仍然是同轮追加”

### Requirement: Queued Follow-up Fusion SHALL Preserve Queue Order Integrity

系统 MUST 在执行单条队列项融合时保持剩余队列顺序稳定，并在失败时恢复被选中的队列项。

#### Scenario: successful fusion removes selected item and preserves remaining order
- **WHEN** 用户对某一条排队消息执行融合
- **AND** 融合流程成功
- **THEN** 系统 MUST 从队列中移除被选中的消息
- **AND** 剩余队列项 MUST 保持点击前的相对顺序

#### Scenario: failed fusion restores original queue position
- **WHEN** 用户对某一条排队消息执行融合
- **AND** 融合流程失败
- **THEN** 系统 MUST 将该消息恢复到原来的队列位置
- **AND** 用户 MUST 能看到明确失败反馈

#### Scenario: fusion pauses same-thread auto-drain until resolved
- **GIVEN** 当前线程存在进行中的融合动作
- **WHEN** 队列自动出队调度评估该线程的待发送消息
- **THEN** 系统 MUST 暂停该线程的自动出队
- **AND** 在融合成功或失败前 MUST NOT 派发下一条排队消息

#### Scenario: active thread isolation prevents cross-thread queue leakage
- **WHEN** 不同线程各自拥有排队消息
- **THEN** 当前 composer 只 MUST 展示活动线程对应的排队区域
- **AND** 对某线程队列项执行融合或删除 MUST NOT 影响其他线程的队列

### Requirement: Queued Follow-up Fusion SHALL Preserve Original Message Payload

系统 MUST 在融合发送时保留原排队消息的完整 payload，而不是退化成纯文本 resend。

#### Scenario: fusion preserves text images and send options
- **GIVEN** 某条排队消息包含 `text`、`images` 或逐条 `sendOptions`
- **WHEN** 用户对该消息执行融合
- **THEN** 系统 MUST 使用与原排队项一致的 `text`、`images` 和 `sendOptions` 发送该消息
- **AND** 系统 MUST NOT 静默丢弃附件或逐条发送参数

