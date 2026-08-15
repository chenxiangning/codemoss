# plugin-runtime-quickjs-isolate-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST give each Worker its own isolate and deny OS APIs by default

每个 Worker isolate MUST 按 `pluginId + entryId + generation` 隔离。对 `require('fs')`、`process`、`fetch`、动态 `import()` 或 Node builtin 的求值 MUST 返回 `permission-denied`。`stop` MUST 丢弃该 isolate。

#### Scenario: notes and claude workers do not share an isolate

- **WHEN** Notes 与 Claude 都激活 Worker
- **THEN** 两者 MUST 持有不同 isolate
- **AND** 一方 `stop` MUST 不影响另一方

#### Scenario: a worker cannot reach node or os apis

- **WHEN** isolate `eval` `require('fs')` / `process.exit` / `fetch` / `import('net')`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`

#### Scenario: disable disposes the worker isolate

- **WHEN** Notes Worker 已 start
- **AND** Host `disable`
- **THEN** 该 isolate MUST 不再存在
