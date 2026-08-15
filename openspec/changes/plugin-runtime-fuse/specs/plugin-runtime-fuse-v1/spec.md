# plugin-runtime-fuse-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST fuse a plugin and revoke all composed handles

`fuse_plugin` MUST 将 slot 置为 `fused` 并 revoke 该 generation 的 DataPlane stream。fuse 之后 Broker read、`open_own_store`、`open_stream` 与再次 activate MUST 失败，直到 `reset`。

#### Scenario: fused plugin cannot use composed handles or reactivate

- **WHEN** Notes 已 ready 并打开 store/stream
- **AND** 调用 `fuse_plugin`
- **THEN** query / open_own_store / open_stream MUST 失败
- **AND** 再次 activate MUST 返回 `fused`
