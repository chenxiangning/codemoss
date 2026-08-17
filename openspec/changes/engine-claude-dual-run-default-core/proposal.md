# Proposal: engine-claude-dual-run-default-core

> OpenSpec change id: `engine-claude-dual-run-default-core`  
> Wave：P4.7 批次 20（第一根插头 · dual-run 默认 Core 收口）  
> 依赖：`engine-claude-process-entry-result`、`notes-plugin-owner-refresh`  
> 架构：`15` §3 Dual-run。同一时刻只有一个 owner。产品默认仍 Core。

## Why

3AN `claude-dual-run-close` 只记了 `MOSSX_CLAUDE_COMPAT_FACADE`。批次 1–18 已把 `MOSSX_CLAUDE_PROCESS_ENTRY` 接到 `send_message` / resume，但盘点仍写「conformance = fixture only」。若不刷新，后续会把 flag-on 探针误当成产品默认路径，或误开 flag / Slim。

本刀刷新 dual-run 事实源，并钉测试：两旗默认关，产品 `send_message` 仍 `cmd.spawn()`，`boot_driver()` 仍 `missing_executable()`。不 Slim，不宣称整根插头完成。

## 目标与边界

1. Dual-run inventory MUST 同时记录 compat 门面与 Process Entry。
2. 未设环境变量时 MUST 走 Core：`cmd.spawn()` + Tokio lines。
3. flag 打开且 plan 合法时 MUST 走 Process Entry；缺 plan MUST Denied。
4. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 迁 Notes 表。

## Capabilities

- `engine-claude-dual-run-default-core-v1`
