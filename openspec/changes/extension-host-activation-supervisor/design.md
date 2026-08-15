# Design: extension-host-activation-supervisor

## Context

1A 已提供 MXPC/MXPD 纯函数。1B 在 Host 内部用这些函数做 handshake 形状校验，但 **transport 仍是内存 channel**。Entry 由 `EntryDriver` trait 驱动，生产 driver 留给 1C。

## Goals

1. 可测的 activation / fuse / generation。
2. 默认关闭。
3. 与产品启动链隔离。

## Non-Goals

- 不 listen。
- 不执行插件 JS。
- 不读用户工作区。

## Decisions

### D1. Host 是纯 Rust 状态机

```text
Host
  enabled: bool
  plugins: Map<pluginId, PluginSlot>
  inflight: u32                 # ≤ 2
PluginSlot
  generation: u64
  state: idle|activating|ready|failed|fused|disabled
  unitId / started: Vec<entryId>
```

TS 侧只测常量与错误码镜像（可选）。权威实现在 Rust，避免两套状态机。

### D2. EntryDriver

```text
trait EntryDriver {
  fn start(entry, generation) -> Result<(), DriverError>
  fn stop(entry, generation)
}
```

测试用 `FakeDriver`：可对某个 entryId 注入 `ready` / `timeout` / `crash`。

### D3. 激活协议

1. `enabled` 否则 `host-disabled`
2. slot 若 `fused` → `fused`
3. `inflight < 2` 否则 `activation-busy`
4. generation += 1，state=`activating`
5. 按 required closure 拓扑 `start`
6. 全部 ready 且未超时 → `ready`
7. 任一层失败 → 反向 `stop` 已启动，state=`failed`，generation 作废

### D4. 不注册 command

`lib.rs` 只 `mod plugin_runtime`。`run()` 不构造 Host。

## Risks

| 风险 | 缓解 |
|---|---|
| 状态机长成真 runtime | Driver 禁止 IO；CI 扫 `std::net` / `Command::new` |
| 过早接 App | 无 Tauri command |
| deadline 用 sleep 污染 CI | 测试注入 `Instant` / 手动 clock |
