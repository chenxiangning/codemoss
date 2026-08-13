# memory-pick-gate Specification (delta)

## Purpose

扩展发送前 Memory Pick Gate：检索 diagnostics、空结果可感、telemetry；不改变 Phase-1 时序与模式语义。

## MODIFIED Requirements

### Requirement: 检索与失败降级

系统 MUST 在闸门路径使用当前 workspace 本地检索，输出可诊断的 `emptyReason` 与 `retrievalMode`，并在空结果、超时或失败时不阻塞发送。

#### Scenario: 空候选直发并带 emptyReason

- **WHEN** 检索完成且候选数为 0
- **THEN** 系统 SHALL NOT 展示挑选闸门
- **AND** SHALL 以 0 注入继续发送用户原文
- **AND** diagnostics.emptyReason SHALL 为 `no_query_terms` 或 `no_match` 之一（按是否有有效检索词）

#### Scenario: 超时直发并可感

- **WHEN** 检索超过实现配置的超时
- **THEN** 系统 SHALL 以 0 注入继续发送
- **AND** diagnostics.emptyReason SHALL 为 `timeout`
- **AND** 当 Composer 记忆参考为 pick 或 always 时，系统 SHALL 向用户展示可理解提示（toast 或等价 status）

#### Scenario: 检索失败直发并可感

- **WHEN** 检索抛错或不可恢复失败
- **THEN** 系统 SHALL 以 0 注入继续发送
- **AND** diagnostics.emptyReason SHALL 为 `error`
- **AND** 当模式为 pick 或 always 时，系统 SHALL 展示失败提示

#### Scenario: 无命中可感（pick/always）

- **WHEN** 存在有效检索词但候选为 0（`no_match`）
- **AND** 记忆参考模式为 pick 或 always
- **THEN** 系统 SHALL 提示未找到相关记忆并已按原文发送
- **AND** SHALL NOT 阻塞发送

#### Scenario: 有候选时 emptyReason 为 ok

- **WHEN** 检索返回至少一条候选
- **THEN** diagnostics.emptyReason SHALL 为 `ok`
- **AND** 系统 SHALL 按既有合同展示闸门（first-pick / pick / always 规则不变）

## ADDED Requirements

### Requirement: 闸门路径 hybrid-capable 检索

系统 MUST 在 Memory Pick Gate 检索路径使用与 Memory Scout 对齐的 hybrid-capable 检索核，并诚实报告 `retrievalMode`。

#### Scenario: 无 embedding provider 时诚实 lexical

- **GIVEN** 当前无可用本地 embedding provider
- **WHEN** 闸门路径执行检索
- **THEN** diagnostics.retrievalMode SHALL 为 `lexical`
- **AND** 系统 MUST NOT 将 lexical 分数伪装为 semantic/hybrid

#### Scenario: provider 可用时允许 hybrid 或 semantic

- **GIVEN** 本地 embedding provider health 为 available
- **WHEN** 闸门路径执行检索且语义分支成功参与排序
- **THEN** diagnostics.retrievalMode SHALL 为 `hybrid` 或 `semantic`
- **AND** 候选排序 SHALL 可同时利用 lexical 与 semantic 信号（在实现支持范围内）

#### Scenario: 语义分支失败降级

- **GIVEN** provider 声明 available 但 embed/scan 失败
- **WHEN** 检索继续
- **THEN** 系统 SHALL 回退 lexical 结果（若有）
- **AND** SHALL 在 diagnostics 记录 fallback 原因
- **AND** SHALL NOT 阻塞发送

### Requirement: Memory Pick 可观测性

系统 MUST 对闸门关键路径发出结构化 telemetry 事件，且 MUST NOT 在事件中记录记忆正文或用户原文全文。

#### Scenario: 检索完成埋点

- **WHEN** 闸门路径完成一次检索（含空/超时/失败）
- **THEN** 系统 SHALL emit `memory_pick_retrieve`
- **AND** props SHALL 包含 emptyReason、retrievalMode、candidateCount、耗时类字段
- **AND** props SHALL NOT 包含记忆 raw/detail 或 query 全文

#### Scenario: 用户决策埋点

- **WHEN** 用户确认、跳过、dismiss 或取消闸门
- **THEN** 系统 SHALL 分别 emit `memory_pick_confirm` / `memory_pick_skip` / `memory_pick_dismiss` / `memory_pick_cancel`（或实现映射的等价事件名且文档记载）
- **AND** confirm 事件 SHALL 包含 selectedCount 与 mode

#### Scenario: 自动确认埋点

- **WHEN** always 自动确认触发或被打断
- **THEN** 系统 SHALL emit `memory_pick_auto_confirm` 并区分 fire 与 interrupt

#### Scenario: 闸门展示埋点

- **WHEN** 挑选闸门进入 awaiting-choice 且展示给用户
- **THEN** 系统 SHALL emit `memory_pick_gate_shown`
