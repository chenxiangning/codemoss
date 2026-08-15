# plugin-runtime-quickjs-eval-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker eval MUST complete within the eval deadline

`eval` MUST 在 `EVAL_DEADLINE` 内完成。超时 MUST `deadline`，MUST interrupt QuickJS。超时后 isolate MUST 仍可执行合法 `mossx.sdk.*`。MUST NOT 切产品。

#### Scenario: an infinite loop cannot hang the host

- **WHEN** Notes worker 已 Ready
- **AND** Host `eval("mossx.handshake.hello();while(true){}")` 且 deadline 很短
- **THEN** 调用 MUST `deadline`
- **AND** 随后 `eval("mossx.sdk.ready()")` MUST 成功
