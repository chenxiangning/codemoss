# Proposal: engine-claude-process-entry-supervise

> OpenSpec change id: `engine-claude-process-entry-supervise`  
> Wave：P4.7 批次 2（第一根插头 · Process Entry 监督 CLI）  
> 依赖：`engine-claude-process-entry-peer`  
> 架构：[`06` §5](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md) · [`14` §5.2 / §13](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

批次 1 证明 Host 能按 Manifest 解析并 handshake 一个 Process Entry。生产 Claude CLI 不会说 MXPC，不能直接当 Process Entry。总设计要求 Process Entry 是 Host 拥有的受限 executable，再由它承担 CLI / PTY / session transport。

本刀补上这一段：handshake 之后，Host 用封闭 MXPC `mossx.process.supervise` 让 Process Entry 拉起 CLI 子进程。子进程必须进同一进程组；`interrupt` / `uninstall` 杀组时 CLI 不得成孤儿。仍不替换 `engine/claude.rs`。

## 目标与边界

1. Process Entry 在 handshake 后只接受 `mossx.process.supervise`。未知 method fail closed。
2. `executable` 必须绝对路径、过 allowlist、是真实文件；禁止 shell / node / python 等 stem。
3. 被监督进程与 Process Entry 同进程组；Host `interrupt` / `uninstall` 后组内无残留。
4. **MUST NOT** 改 `boot_driver()`、**MUST NOT** 改生产 `engine/claude.rs` spawn、**MUST NOT** 开 flag、**MUST NOT** Slim、**MUST NOT** 开 Marketplace。
5. 不得宣称产品 stream / storage / rollback conformance 完成。

## Capabilities

- `engine-claude-process-entry-supervise-v1`
