# plugin-runtime-quickjs-allowlist-v1 Spec Delta

## ADDED Requirements

### Requirement: QuickJS Worker MUST only eval Mossx handshake or SDK calls

live isolate 的 `eval` MUST 只接受以 `mossx.handshake.` 或 `mossx.sdk.` 开头的源。任意 JS MUST 返回 `permission-denied`。

#### Scenario: a handshake call is accepted

- **WHEN** isolate 已 start
- **AND** `eval` `mossx.handshake.hello()`
- **THEN** 调用 MUST 成功

#### Scenario: arbitrary javascript is denied

- **WHEN** isolate 已 start
- **AND** `eval` `1 + 1` 或 `eval('1')`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`
