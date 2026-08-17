# Design

映射只读 `EngineConfig.bin_path` / settings `claudeBin` 的字符串，不读 PATH、不 fallback 到裸 `claude`。生产 `resolve_cli_binary()` 仍可 fallback；插件路径必须 fail closed。

```text
bin 空/非法 → None → missing_executable
bin 合法 + Process Entry 文件存在 → handshake driver + supervise(bin)
Process Entry 缺失 → missing_executable（即使 bin 合法）
```

`argv` 本刀固定为空。生产 CLI 的 `-p` / stream-json 参数仍由 `engine/claude.rs` 持有，下一批 dual-run 再搬。
