# Proposal: engine-claude-runtime-driver

> OpenSpec change id: `engine-claude-runtime-driver`  
> Wave：P4.7 前置（第一根插头 · 真实运行时 driver 接入）  
> 依赖：`engine-claude-disable-not-delete-inventory`（Wave 3AM）  
> 架构：[`15` §3 step 6→7](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) · [`03` §3](../../../docs/architecture/plugin-platform/03-lifecycle-hot-swap-and-rollback.md)

## Why

勘定（`docs/architecture/plugin-platform/inventory/real-uninstall-dependency-chain.md`）确认：真实运行时（Host + RestrictedProcess + QuickJS + CompositeDriver）已完整实现但 `default-off`，`boot_driver()` 用 `missing_executable()` 作安全闸门，从未指向真实可执行文件；Claude 门面是 delegate-to-Core 死路径；生产 `engine/claude.rs`（11862 行）自 spawn 真实 CLI，但不在插件运行时内。

「真实卸载」= 停掉真实运行在插件运行时里的引擎。当前连「Claude 跑在插件运行时」都未建立，卸载无从谈起。本刀建立最小通路：让 RestrictedProcessDriver 能解析并 spawn 真实可执行文件，为后续把 `engine/claude.rs` 的进程管理迁入插件运行时铺路。

## 目标与边界

1. 建立「可执行文件解析」通路：`RestrictedProcessDriver` 从显式注入的可执行文件路径（而非 `missing_executable()`）构造，且该路径来自可审计来源（engine config / settings 的 `claudeBin`）。
2. 提供 `with_handshake` 的真实 spawn 通路，供 conformance 验证真实 CLI 的 handshake 契约。
3. **MUST NOT** 修改 `boot_driver()`（仍用 `missing_executable()`，保持 default-off 安全闸门）。
4. **MUST NOT** 把 `engine/claude.rs` 迁入插件运行时（那是后续 change）。
5. **MUST NOT** 删 `engine/claude*`、不默认开 `MOSSX_CLAUDE_COMPAT_FACADE`、不开 Marketplace。
6. 真实 CLI 环境的 spawn/handshake 验收作为**明确 gate**，未在真实环境验证前不得宣称 conformance 通过。

## Capabilities

- `engine-claude-runtime-driver-v1`
