# conversation-tool-output-budget Spec Delta

## ADDED Requirements

### Requirement: Assembled commandExecution output MUST stay within a byte budget

系统 MUST 在把 `commandExecution` 文本写入 `ConversationItem.output` 之前应用 head+tail 预算。默认预算 MUST 为 256 KiB，其中头部 MUST 保留不少于 64 KiB（若原文更短则全留）。超限文本 MUST 含可解析的 omitted 标记，且尾部 MUST 是原文最后一段。预算 MUST 作用于 live delta、item snapshot / completed、以及 history hydrate。

#### Scenario: live deltas beyond 10 MiB stay bounded

- **WHEN** 同一 `commandExecution` item 连续追加合计超过 10 MiB 的 `appendToolOutputDelta`
- **THEN** 该 item 的 `output` 字符数 MUST ≤ 256 KiB
- **AND** `output` MUST 包含 omitted 标记
- **AND** `output` 的尾部 MUST 等于最后一段未被丢弃的原文

#### Scenario: completed snapshot larger than the budget is bounded

- **WHEN** `item/updated` 或 `item/completed` 带来超过 5 MiB 的 `commandExecution` output
- **THEN** 写入会话态后的 `output` MUST ≤ 256 KiB
- **AND** MUST 保留头部与尾部，不得只留 head 或只留 tail

#### Scenario: history hydrate bounds oversized commandExecution

- **WHEN** history loader 产出一条超过预算的 `commandExecution` item
- **THEN** `normalizeItem` / hydrate 后的 `output` MUST ≤ 256 KiB

#### Scenario: repeated append keeps omitted count cumulative

- **WHEN** 一条已经预算截断的 `commandExecution` 再次追加 delta 并再次超限
- **THEN** omitted 数字 MUST 累加被丢弃的字符，不得只报告本轮丢掉的增量

### Requirement: fileChange output MAY use a larger budget and MUST NOT lose small diffs

`fileChange` 输出 MUST 使用独立预算，默认 1 MiB。小于该预算的 diff MUST 原样保留。

#### Scenario: small fileChange diff is preserved

- **WHEN** `fileChange` output 长度为 80 KiB
- **THEN** 系统 MUST NOT 截断该 output

#### Scenario: huge fileChange output is bounded

- **WHEN** `fileChange` output 超过 1 MiB
- **THEN** 写入会话态后的 `output` MUST ≤ 1 MiB
- **AND** MUST 使用 head+tail + omitted 标记

### Requirement: Tool output budget MUST be disableable without dropping events

系统 MUST 提供 `ccgui.perf.toolOutputBudget` 开关，默认开启。关闭后 `commandExecution` 可按变更前语义保留全文。无论开关状态，`item/commandExecution/outputDelta` 事件 MUST 仍然送达，不得在 sink / snapshot throttle 层丢弃。

#### Scenario: budget flag off restores unbounded commandExecution store text

- **WHEN** `ccgui.perf.toolOutputBudget` 为 `off`
- **THEN** `boundToolOutput` MUST 原样返回输入
- **AND** 现有 `outputDelta` 送达契约 MUST 保持不变
