# Design

Control 方法冻结为：

```json
{
  "jsonrpc": "2.0",
  "id": "sup-1",
  "method": "mossx.process.supervise",
  "params": {
    "executable": "/absolute/path",
    "argv": ["30"]
  }
}
```

`RestrictedProcessDriver` 在 handshake 成功后，若配置了 supervise 目标，立刻发该请求并等 ack。失败则杀 Process Entry，返回 `DriverError::Crash`。

Process Entry（`packages/plugin-engine-claude/src/process_entry.rs`）自己做路径闸门后 `Command::spawn`。Unix 上子进程继承 leader 的 `process_group(0)`，因此现有 `kill_child` 整组 `SIGKILL` 覆盖 CLI。

生产 `ClaudeSession` 仍自己 spawn。本刀只建立「Host 拥有的监督面」，下一步才把 `engine/claude.rs` 的 bin_path 接到这个 supervise 调用。
