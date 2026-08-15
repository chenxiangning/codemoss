# plugin-runtime-quickjs-minimal-context-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker QuickJS context MUST be base objects plus Eval only

Worker isolate MUST NOT 用 `Context::full`。MUST 只用 BaseObjects + Eval。`new Date()` / `JSON.stringify` / `Promise.resolve` MUST 失败。`mossx.handshake.hello()` MUST 仍可执行。MUST NOT 切产品。

#### Scenario: extra javascript intrinsics cannot run

- **WHEN** Notes worker 已 Ready
- **AND** Host 用 raw eval 执行 `new Date()` / `JSON.stringify({})` / `Promise.resolve(1)`
- **THEN** 调用 MUST 失败
- **AND** 随后 `eval("mossx.handshake.hello()")` MUST 成功
