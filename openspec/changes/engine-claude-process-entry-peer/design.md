# Design

Process Entry 源码落在 `packages/plugin-engine-claude/src/process_entry.rs`，由测试 `rustc` 编到临时制品树的 Manifest 声明路径（如 `bin/darwin-arm64/claude`）。生产仓库不提交预编译二进制。

`plugin_runtime::claude_process` 负责：

- `current_platform_id()`：`14` §5.2 六平台精确匹配，未知平台 fail closed。
- `resolve_process_entry_path(plugin_root, manifest, platform)`：只读 `kind=process` 且 `id=claude-cli` 的 `platforms[platform]`，拼 `plugin_root`，拒绝 `..` / 相对路径 / 非文件。
- `claude_process_driver_for(plugin_root)`：解析成功则 `restricted_process_driver_for(Some(path))`；否则回落 `missing_executable()`，保证调用方不会误 spawn。

`claude_pilot` 仍只提供 fixture `ActivationRequest`。本刀不把生产 `ClaudeSession` 换成 driver。
