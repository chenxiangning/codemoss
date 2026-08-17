# Proposal: engine-claude-process-entry-peer

> OpenSpec change id: `engine-claude-process-entry-peer`  
> Wave：P4.7 批次 1（第一根插头 · 真实 Process Entry）  
> 依赖：`engine-claude-runtime-driver`（可审计 bin_path + handshake 通路）  
> 架构：[`06` §5](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md) · [`14` §5.2](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md) · [`15` §3 step 6](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

`engine-claude-runtime-driver` 只证明：给 `RestrictedProcessDriver` 塞一个绝对路径，就能 spawn 测试 peer。那条路径不是 Manifest Process Entry，也不是插件制品里的 executable。生产 `engine/claude.rs` 仍自己 `Command::spawn` Claude CLI。

总设计要求 Engine Process Entry 是 **Host 拥有的受限 executable**，路径来自 Manifest `entries[].platforms[PlatformId]`。本刀把「真插头」的第一段落地：Claude 过渡仓自带 Process Entry 源码，Host 按 Manifest 解析当前平台路径，handshake 成功后 generation 可 interrupt / uninstall。这还不是产品 CLI 迁入，而是插头身份从 fixture 变成制品声明。

## 目标与边界

1. `packages/plugin-engine-claude` 提供独立 Process Entry 源码（MXPC handshake peer），**不是** 生产 Claude CLI。
2. Host 侧按 Manifest `claude-cli` + 当前 `PlatformId` 解析 artifact-relative executable；路径必须绝对、过 allowlist、是真实文件才 spawn。
3. 解析成功后走已有 `with_handshake` 通路；activate → Ready → interrupt 回 Idle / uninstall 进终态。
4. **MUST NOT** 改 `boot_driver()`；仍用 `missing_executable()`。
5. **MUST NOT** 改 `engine/claude.rs` 生产 spawn，MUST NOT 默认开 `MOSSX_CLAUDE_COMPAT_FACADE`，MUST NOT 开 Marketplace，MUST NOT Slim。
6. 不得把本刀写成 stream / storage / rollback 产品 conformance 完成。

## Capabilities

- `engine-claude-process-entry-peer-v1`
