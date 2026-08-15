# plugin-broker-readonly-v1 Spec Delta

## ADDED Requirements

### Requirement: Broker MUST expose only generation-scoped workspace read

V1 Broker stub MUST 只允许 `mossx.workspace.read`。调用 MUST 携带当前 `pluginId` 与 generation。slot 非 `ready` 或 generation 过期 MUST fail closed。`mossx.workspace.write`、`mossx.process.spawn` 与未知 capability MUST 返回 `permission-denied`。Broker MUST NOT 读取真实用户文件系统。

#### Scenario: ready plugin can read fixture workspace

- **WHEN** plugin 处于 `ready` 且 generation 匹配
- **AND** 请求 `mossx.workspace.read`
- **THEN** Broker MUST 返回注入的 fixture workspace path

#### Scenario: write or stale generation is denied

- **WHEN** 请求 `mossx.workspace.write`，或 generation 不是当前值
- **THEN** Broker MUST 拒绝，且 MUST NOT 返回 workspace path
