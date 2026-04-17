## ADDED Requirements

### Requirement: User Bubble SHALL Preserve User Input Formatting Fidelity

用户在输入框中的原始文本结构（如换行、空行、缩进、编号与列表节奏）在聊天幕布的用户气泡中 MUST 保持可见一致，不得被显示层压平或重排。

#### Scenario: multi-line structured input keeps visible structure in user bubble

- **GIVEN** 用户消息文本在展示阶段已完成 `[User Input]` 提取
- **WHEN** 用户消息气泡渲染该文本
- **THEN** UI MUST 保留用户输入中的换行、空行、缩进与编号层级
- **AND** MUST NOT 将结构化输入压平为单段连续文本

#### Scenario: formatting fidelity is display-only and does not mutate raw message payload

- **GIVEN** 用户消息包含任意结构化文本
- **WHEN** 系统应用用户气泡格式保真展示
- **THEN** 该转换 MUST 仅作用于展示文本
- **AND** 消息原始文本值 MUST 保持不变

#### Scenario: copy action remains bound to original message text

- **GIVEN** 用户消息气泡显示了格式保真后的文本
- **WHEN** 用户点击复制消息
- **THEN** 复制内容 MUST 继续使用原始消息文本
- **AND** MUST NOT 把 display-only 展示结果写回消息正文

#### Scenario: license block is treated as one example under the same generic rule

- **GIVEN** 用户输入包含 `BEGIN LICENSE ... END LICENSE` 区块
- **WHEN** 用户消息气泡渲染文本
- **THEN** 系统 MUST 以与其他结构化输入一致的通用规则保留其结构可读性
- **AND** MUST NOT 通过 license-only 特判替代通用格式保真能力

### Requirement: External Spec Root Prompt Injection SHALL Be First-Turn Only In Codex

当 workspace 配置了外部 Spec 根目录时，Codex 发送链路对提示文本的自动拼接 MUST 仅在新会话首条消息发生一次，避免后续轮次重复噪音。

#### Scenario: first codex turn prepends spec root context

- **GIVEN** 当前线程为 Codex
- **AND** workspace 已配置可用的外部 Spec 根目录
- **AND** 线程尚无历史消息
- **WHEN** 用户发送首条消息
- **THEN** 系统 MAY 自动拼接 `[Session Spec Link]` 与 `[Spec Root Priority]` 上下文提示
- **AND** 该拼接 MUST 与本轮用户输入共同下发

#### Scenario: follow-up codex turns do not prepend spec root context repeatedly

- **GIVEN** 当前线程为 Codex
- **AND** workspace 已配置外部 Spec 根目录
- **AND** 线程已存在历史消息
- **WHEN** 用户发送后续消息
- **THEN** 系统 MUST NOT 再次自动拼接 `[Session Spec Link]` 或 `[Spec Root Priority]`
- **AND** 用户消息正文 MUST 保持原始输入语义

#### Scenario: custom spec root path propagation remains intact after first-turn gating

- **GIVEN** workspace 已配置外部 Spec 根目录
- **WHEN** Codex 发送任意轮次消息
- **THEN** 系统 MUST 继续透传 `customSpecRoot` 路径上下文到后端发送参数
- **AND** 首条提示注入收敛 MUST NOT 影响 Spec 根路径可用性
