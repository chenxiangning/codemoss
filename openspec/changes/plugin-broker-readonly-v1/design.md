# Design: plugin-broker-readonly-v1

## Decisions

### D1. Broker 不持有 FS

`workspace_root` 是构造时注入的字符串 fixture，例如 `/fixture/workspace`。`read` 只返回该字符串与 `pluginId`。

### D2. 授权检查顺序

1. Host slot 必须 `ready`
2. generation 必须当前
3. capability ∈ 本 change allowlist（仅 `mossx.workspace.read`）
4. 否则 `permission-denied` 或 `stale-generation`

### D3. 不改 Host 激活协议

Broker 持有 `&Host` 或查询闭包。1D 用 `Broker::query(host, pluginId, generation, capability)`。
