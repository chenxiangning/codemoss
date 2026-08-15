# plugin-runtime-quickjs-engine-v1 Spec Delta

## ADDED Requirements

### Requirement: a live Worker isolate MUST own a real QuickJS runtime

`QuickJsWorkerDriver::start` 在 handshake 成功后 MUST 为该 isolate 创建独立 QuickJS Runtime。`eval` 在 allowlist 通过后 MUST 在该 Runtime 执行。非法 JS MUST fail closed。`stop` MUST drop Runtime。MUST NOT 提供 Node/OS API。MUST NOT 切产品。

#### Scenario: an allowed handshake call is executed by QuickJS

- **WHEN** Notes worker 已 Ready
- **AND** Host `eval("mossx.handshake.hello()")`
- **THEN** 调用 MUST 成功
- **AND** 执行 MUST 经过 QuickJS Runtime

#### Scenario: allowlisted but invalid JavaScript cannot stay half-executed

- **WHEN** Notes worker 已 Ready
- **AND** Host `eval("mossx.handshake.hello(")`
- **THEN** 调用 MUST 失败
- **AND** isolate MUST 仍活着，可再 eval 合法调用

#### Scenario: node and os apis remain unreachable

- **WHEN** Notes worker 已 Ready
- **AND** Host `eval("require('fs')")` 或 `eval("1 + 1")`
- **THEN** 调用 MUST `permission-denied`
- **AND** 不得进入产品路径
