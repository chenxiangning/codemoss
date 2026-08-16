# Contract + Socket Close

> 日期：2026-08-16  
> 口径：V1 合同 = `14-v1-contract-freeze.md` + `08` P0；插座 = Host / IPC / transport / 隔离存储 / 默认 off boot。  
> 这不是产品拔插头，也不是远程 Marketplace。

## 合同 100%（P0 / 文档 14）

| 项 | 状态 | 证据 |
|---|---|---|
| P0.1 ownership inventory | 齐 | `inventory/ownership.json` |
| P0.2 Manifest parser | 齐 | `parseManifestV1` |
| P0.3 Contribution / Capability / template | 齐 | parser + catalog |
| P0.4 fitness fixtures | 齐 | `packages/plugin-contract/fixtures` |
| P0.5 TS/Rust contract 边界 | 齐 | `packages/plugin-contract` + `src/plugin-kernel` + `plugin_runtime` |
| P0.6 小型 OpenSpec | 齐 | 各 wave change |
| P0.7 注册信封 | 齐 | `validateRegistration` |
| P0.8 安装预览不执行代码 | 齐 | `previewInstall` |
| P0.9 pluginId+version hash 唯一 | 齐 | parser `hash-conflict` |
| P0.10 entries Closed Schema | 齐 | parser |
| P0.11 Physical DAG | 齐 | cycle / dangling 拒绝 |
| P0.12 deadline 1s–30s | 齐 | parser budgets |
| P0.13 Catalog schema | 齐 | `schemas/capabilities` |
| P0.14 template matcher | 齐 | parser |
| P0.15 Activation / onStartup 白名单 | 齐 | parser |
| P0.16 MXPC/MXPD | 齐 | `src/plugin-kernel/ipc` + Rust |
| P0.17 未知字段拒绝 | 齐 | parser |

Go generated types 按 D-047 仅 types、本仓库不实现。远程签名 / SBOM / Registry 属 P6，不计入合同 100%。

## 插座 100%（可测、默认 off）

| 面 | 状态 | 证据 |
|---|---|---|
| Host 状态机 | 齐 | idle→activating→ready\|failed\|fused\|disabled |
| MXPC handshake | 齐 | loopback / UDS / named pipe / stdio |
| Restricted Process supervisor | 齐 | `spawn.rs`，默认 missing executable |
| QuickJS Worker | 齐 | `quickjs.rs`，不进产品 |
| Broker 只读 | 齐 | fixture workspace |
| 隔离存储 + checkpoint | 齐 | `disk_storage` / `storage` |
| 默认 off boot | 齐 | `boot.rs` 不装过渡仓 |
| 只读插排 | 齐 | `get_plugin_rack_snapshot`，无 `activate_plugin` |

插座 100% 的含义：插排可测、可看、可假关、不进产品启动链。不是：市场一点就能改产品行为。

## 明确仍关

1. 远程 Marketplace / 签名制品 / SBOM
2. 产品 disable Claude / Notes
3. 删除 `engine/claude*`
4. 迁移 `note_cards`
5. 默认打开 `MOSSX_CLAUDE_COMPAT_FACADE`
6. push
