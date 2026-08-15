# plugin-runtime-quickjs-single-call-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker eval source MUST be a single mossx bridge call

合法 Worker 源码 MUST 整段为 `mossx.handshake.<ident>()` 或 `mossx.sdk.<ident>()`。尾随语句 MUST `permission-denied`，MUST NOT 进入 QuickJS。MUST NOT 切产品。

#### Scenario: a trailing statement cannot enter the engine

- **WHEN** Notes worker 已 Ready
- **AND** Host `eval("mossx.handshake.hello();1+1")`
- **THEN** 调用 MUST `permission-denied`
- **AND** 随后 `eval("mossx.handshake.hello()")` MUST 成功
