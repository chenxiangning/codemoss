# project-memory-consumption Delta

## ADDED Requirements

### Requirement: 发送前挑选闸门作为显式消费路径

系统 MUST 将 Memory Pick Gate 视为与手动选择、历史 Memory Reference 并列的显式消费路径，且 MUST NOT 在 off 且无手动选择、无闸门确认时静默注入。

#### Scenario: off 且无闸门不注入

- **WHEN** Composer 记忆参考为 off
- **AND** 本 turn 未进入挑选闸门确认
- **AND** 用户未手动选择记忆
- **THEN** 系统 SHALL 发送用户原始文本
- **AND** SHALL NOT 自动注入 project-memory pack

#### Scenario: 闸门确认后的注入来源

- **WHEN** 用户经挑选闸门确认注入 k 条记忆
- **THEN** 注入来源 SHALL 标记为 `memory-pick`
- **AND** 时间线关联资源展示 SHALL 可区分于 `manual-selection` 与历史 `memory-scout`

### Requirement: always 模式 TopK 注入

系统 MUST 在 always 模式下按相关分注入固定 TopK（默认 3）记忆，替代仅「每轮 Scout 无确认」的不可见行为（用户可通过 Composer 与文案感知 always）。

#### Scenario: always 注入 top(n)

- **WHEN** session 处于 always 且本 turn 非 first-pick 手勾路径
- **AND** 用户确认（含倒计时自动确认）always 预览结果
- **THEN** 系统 SHALL 注入用户当前勾选集合（预勾默认为相关分 Top n，n 默认 3 或上次确认条数）
- **AND** 注入块 source SHALL 为 `memory-pick`
- **AND** 幕布预览文案 SHALL 可区分 always 与 pick（pack 属性可不写 mode/topk）

## MODIFIED Requirements

### Requirement: 前端消息注入

系统 MUST 在用户发送消息前采用「手动选择优先 + 显式记忆参考（本轮挑选 / 一直开启 / 关闭）+ 可选发送前挑选闸门」策略，不再执行静默自动相关性检索注入。

#### Scenario: 未手动选择且未开启记忆参考且未进闸门时不注入

- **WHEN** 用户发送消息且本次未手动选择任何记忆
- **AND** Composer 记忆参考为 off
- **AND** 本 turn 未发生挑选闸门确认注入
- **THEN** 系统 SHALL 直接发送用户原始文本
- **AND** SHALL NOT 自动调用相关性注入流程

#### Scenario: 开启一直开启后的注入

- **WHEN** 用户将记忆参考设为一直开启（always）
- **AND** 本 turn 按 always 路径发送
- **THEN** 系统 SHALL 注入 TopK 项目记忆（默认 3）
- **AND** 注入来源 SHALL 可审计为 memory-pick（always）或实现约定的等价标记

#### Scenario: 本轮挑选闸门注入

- **WHEN** 用户经挑选闸门勾选并确认
- **THEN** 系统 SHALL 注入勾选记忆
- **AND** 注入来源 SHALL 为 `memory-pick`

#### Scenario: 手动选择与挑选闸门并存

- **WHEN** 用户已手动选择记忆
- **AND** 同时经闸门勾选记忆
- **THEN** 系统 SHALL 合并注入并按 memory id 去重
- **AND** UI SHALL 可区分来源

#### Scenario: 当次发送后清理

- **WHEN** 注入发送完成（成功或失败后收敛）
- **THEN** 系统 SHALL 清空本次手动选择集合
- **AND** 本轮挑选闸门 UI SHALL 卸载
- **AND** always 模式 SHALL 保持直到用户关闭或 dismiss session 询问
