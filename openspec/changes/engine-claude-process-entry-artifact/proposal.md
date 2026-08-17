# Proposal: engine-claude-process-entry-artifact

> OpenSpec change id: `engine-claude-process-entry-artifact`  
> Wave：P4.7 批次 15（第一根插头 · 可激活制品）  
> 依赖：`engine-claude-process-entry-wait`  
> 架构：Process Entry 是 Host 拥有的可执行文件；仓库不提交预编译二进制。

## Why

批次 1–14 已把 flag-on 路径接到 Process Entry。产品 `claude_plugin_package_root()` 却指向过渡仓源码树，那里没有 Manifest 声明的 `bin/<platform>/claude`。flag-on 会永远 `activation-failed`，插头仍是测试夹具。

本刀在 `src-tauri/build.rs` 按需 `rustc` 到 `OUT_DIR` 制品根。运行时只解析该根。不提交二进制，不开 flag，不 Slim，不宣称 stream conformance。

## 目标与边界

1. 当前平台 MUST 在制品根落下声明路径文件。
2. 源码仓 `packages/plugin-engine-claude` MUST NOT 因此出现提交用 `bin/`。
3. 缺文件 MUST 仍 `activation-failed`。`boot_driver()` MUST 仍 `missing_executable()`。

## Capabilities

- `engine-claude-process-entry-artifact-v1`
